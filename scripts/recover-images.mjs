#!/usr/bin/env node
// Recovers missing images in imported articles by trying multiple archive sources:
//   1. Arquivo.pt captures of the original page (different timestamps, im_ URLs)
//   2. Wayback Machine captures (different timestamps)
//   3. The live site as a last resort
//
// For each article with missing images (no local img-*/ capa files, or REVER markers),
// it reads index.md to find the original URL, then fetches archive captures of that page
// to extract and download the images.
//
//   node scripts/recover-images.mjs [--dry-run] [--article <slug>]
//
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { parseArgs, ARTICLES_DIR } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const USER_AGENT = 'Mozilla/5.0 (arquivo pessoal; +https://github.com/JIGLE/MR)';
const TIMEOUT = 30_000;

const extFromType = (type) => ({
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg'
})[type?.split(';')[0]?.trim()];

const extFromUrl = (url) => {
  try { return (new URL(url).pathname.match(/\.(jpe?g|png|webp|gif|avif|svg)$/i)?.[1] ?? '').toLowerCase().replace('jpeg', 'jpg'); }
  catch { return ''; }
};

async function fetchBuffer(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!res.ok) {
        if (res.status === 429 && i < retries) {
          await new Promise(r => setTimeout(r, 5000 * (i + 1)));
          continue;
        }
        throw new Error(`${res.status} ${res.statusText}`);
      }
      return { buffer: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '' };
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

/** Find Arquivo.pt captures of a URL, sorted by date descending. */
async function arquivoCaptures(originalUrl) {
  const q = new URLSearchParams({ url: originalUrl, maxItems: '20', fields: 'tstamp,linkToArchive,linkToNoFrame' });
  try {
    const data = await (await fetch(`https://arquivo.pt/textsearch?${q}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT)
    })).json();
    return (data.response_items ?? []).sort((a, b) => (b.tstamp || '').localeCompare(a.tstamp || ''));
  } catch (err) {
    console.warn(`  ! Arquivo.pt captures: ${err.message}`);
    return [];
  }
}

/** Find Wayback Machine captures of a URL. */
async function waybackCaptures(originalUrl) {
  const q = new URLSearchParams({ url: originalUrl, output: 'json', filter: 'statuscode:200', fl: 'timestamp,original', limit: '20' });
  try {
    const rows = (await (await fetch(`https://web.archive.org/cdx/search/cdx?${q}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT)
    })).json()).slice(1);
    return rows.map(([ts, orig]) => ({
      url: `https://web.archive.org/web/${ts}id_/${orig}`,
      timestamp: ts,
      imPrefix: `https://web.archive.org/web/${ts}im_/`
    })).reverse();
  } catch (err) {
    console.warn(`  ! Wayback captures: ${err.message}`);
    return [];
  }
}

/** Extract image URLs from an archived page. */
function extractImages(html, pageUrl) {
  const doc = new JSDOM(html, { url: pageUrl, virtualConsole: new VirtualConsole() }).window.document;
  const images = new Map();

  // Try og:image first for cover
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                  doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');

  // Get article body images
  const article = doc.querySelector('article, .article-body, .entry-content, .post-content, [itemprop="articleBody"], .content-text, main');
  const container = article || doc.body;

  for (const img of container.querySelectorAll('img')) {
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    let src;
    if (srcset) {
      const candidates = srcset.split(',').map(c => c.trim().split(/\s+/)).map(([u, w]) => [u, parseFloat(w) || 1]);
      candidates.sort((a, b) => b[1] - a[1]);
      src = candidates[0]?.[0];
    }
    src = src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || img.getAttribute('src');
    if (!src || src.startsWith('data:') || src.includes('logo') || src.includes('avatar') || src.includes('icon')) continue;
    try {
      const abs = new URL(src, pageUrl).href;
      const alt = img.getAttribute('alt') || '';
      if (!images.has(abs)) images.set(abs, alt);
    } catch {}
  }

  return { ogImage, bodyImages: [...images.entries()] };
}

/** Turn an archive-wrapped image URL into an im_ (image-mode) URL for better quality. */
function toArchiveImageUrl(src, captureUrl) {
  // Arquivo.pt
  const arquivoMatch = captureUrl.match(/^(https?:\/\/arquivo\.pt\/(?:wayback|noFrame))\/(\d+)\//);
  if (arquivoMatch) {
    const [, base, ts] = arquivoMatch;
    // Strip any existing archive prefix from src
    const clean = src.replace(/^https?:\/\/arquivo\.pt\/(?:wayback|noFrame)\/\d+(?:[a-z_]+)?\//, '');
    return `https://arquivo.pt/wayback/${ts}im_/${clean}`;
  }
  // Wayback
  const wbMatch = captureUrl.match(/^(https?:\/\/web\.archive\.org\/web)\/(\d+)/);
  if (wbMatch) {
    const [, base, ts] = wbMatch;
    const clean = src.replace(/^https?:\/\/web\.archive\.org\/web\/\d+(?:[a-z_]+)?\//, '');
    return `${base}/${ts}im_/${clean}`;
  }
  return src;
}

async function downloadImage(url, dir, name) {
  try {
    const { buffer, type } = await fetchBuffer(url);
    if (buffer.length < 1000) return null; // too small, likely a placeholder
    const ext = extFromType(type) || extFromUrl(url) || 'jpg';
    const file = `${name}.${ext}`;
    await writeFile(join(dir, file), buffer);
    return file;
  } catch (err) {
    return null;
  }
}

// --- Main ---
async function findArticlesNeedingImages() {
  const articles = [];
  const years = await readdir(ARTICLES_DIR).catch(() => []);
  for (const year of years) {
    const yearDir = join(ARTICLES_DIR, year);
    const slugs = await readdir(yearDir).catch(() => []);
    for (const slug of slugs) {
      const dir = join(yearDir, slug);
      const indexPath = join(dir, 'index.md');
      try {
        const content = await readFile(indexPath, 'utf8');
        const files = await readdir(dir);
        const hasImages = files.some(f => f.startsWith('img-') || f.startsWith('capa.'));
        const hasRever = content.includes('REVER');
        const noCover = !files.some(f => f.startsWith('capa.'));

        if (!hasImages || hasRever || noCover) {
          // Parse original URL from frontmatter
          const urlMatch = content.match(/^originalUrl:\s*["']?([^\s"']+)/m);
          const archiveMatch = content.match(/^archiveUrl:\s*["']?([^\s"']+)/m);
          const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
          articles.push({
            dir, slug, content, indexPath,
            originalUrl: urlMatch?.[1],
            archiveUrl: archiveMatch?.[1],
            title: titleMatch?.[1] || slug,
            hasImages, hasRever, noCover,
            existingFiles: files
          });
        }
      } catch {}
    }
  }
  return articles;
}

const articles = await findArticlesNeedingImages();
console.log(`Found ${articles.length} articles needing image recovery.\n`);

if (args.article) {
  const filtered = articles.filter(a => a.slug === args.article || a.dir.includes(args.article));
  if (!filtered.length) { console.error(`No matching article: ${args.article}`); process.exit(1); }
  articles.length = 0;
  articles.push(...filtered);
}

let recovered = 0, failed = 0;
const report = [];

for (const art of articles) {
  console.log(`\n--- ${art.title} ---`);
  console.log(`  Dir: ${art.dir}`);
  console.log(`  Original: ${art.originalUrl || 'none'}`);
  console.log(`  Has images: ${art.hasImages}, REVER markers: ${art.hasRever}, No cover: ${art.noCover}`);

  if (!art.originalUrl) {
    console.log('  ✗ No original URL, skipping');
    report.push({ ...art, result: 'no-url' });
    failed++;
    continue;
  }

  if (args['dry-run']) {
    report.push({ ...art, result: 'dry-run' });
    continue;
  }

  let success = false;

  // Try Arquivo.pt captures first
  const arqCaptures = await arquivoCaptures(art.originalUrl);
  console.log(`  Arquivo.pt: ${arqCaptures.length} captures`);

  for (const capture of arqCaptures.slice(0, 5)) {
    const captureUrl = capture.linkToNoFrame || capture.linkToArchive;
    if (!captureUrl) continue;
    console.log(`  Trying: ${captureUrl}`);

    try {
      const html = await (await fetch(captureUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT)
      })).text();

      const { ogImage, bodyImages } = extractImages(html, captureUrl);
      if (!bodyImages.length && !ogImage) { console.log('    No images found in this capture'); continue; }

      let imgCount = 0;
      // Download cover if missing
      if (art.noCover && ogImage) {
        const ogUrl = toArchiveImageUrl(ogImage, captureUrl);
        const file = await downloadImage(ogUrl, art.dir, 'capa');
        if (file) { console.log(`    ✓ ${file} (cover)`); imgCount++; }
      }

      // Download body images
      const existingImgCount = art.existingFiles.filter(f => f.startsWith('img-')).length;
      let n = existingImgCount;
      for (const [src, alt] of bodyImages) {
        const imgUrl = toArchiveImageUrl(src, captureUrl);
        const file = await downloadImage(imgUrl, art.dir, `img-${String(++n).padStart(2, '0')}`);
        if (file) { console.log(`    ✓ ${file}`); imgCount++; }
      }

      if (imgCount > 0) {
        success = true;
        recovered++;

        // Update index.md: remove REVER markers, update image references
        let updated = art.content;
        // Replace REVER + remote URL images with local ones
        const newFiles = await readdir(art.dir);
        const localImages = newFiles.filter(f => f.startsWith('img-')).sort();

        // Simple approach: replace each REVER block with the corresponding local image
        let localIdx = existingImgCount;
        updated = updated.replace(
          /<!-- REVER: imagem não guardada localmente -->\n!\[([^\]]*)\]\(https?:[^)]+\)/g,
          (match, alt) => {
            if (localIdx < localImages.length) {
              return `![${alt}](./${localImages[localIdx++]})`;
            }
            return match; // keep marker if we don't have enough images
          }
        );

        // Add cover if we downloaded one and it's not in frontmatter
        if (art.noCover) {
          const coverFile = newFiles.find(f => f.startsWith('capa.'));
          if (coverFile && !updated.includes('cover:')) {
            updated = updated.replace(/^(---\n[\s\S]*?)(---)/, `$1cover: "./${coverFile}"\n$2`);
          }
        }

        if (updated !== art.content) {
          await writeFile(art.indexPath, updated);
          console.log(`    Updated index.md`);
        }

        report.push({ ...art, result: 'recovered', images: imgCount });
        console.log(`    Recovered ${imgCount} images from Arquivo.pt`);
        break;
      }
    } catch (err) {
      console.warn(`    ! ${err.message}`);
    }
  }

  if (success) continue;

  // Try Wayback Machine
  const wbCaptures = await waybackCaptures(art.originalUrl);
  console.log(`  Wayback: ${wbCaptures.length} captures`);

  for (const capture of wbCaptures.slice(0, 3)) {
    console.log(`  Trying: ${capture.url}`);
    try {
      const html = await (await fetch(capture.url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT)
      })).text();

      const { ogImage, bodyImages } = extractImages(html, capture.url);
      if (!bodyImages.length && !ogImage) { console.log('    No images found'); continue; }

      let imgCount = 0;
      if (art.noCover && ogImage) {
        const ogUrl = toArchiveImageUrl(ogImage, capture.url);
        const file = await downloadImage(ogUrl, art.dir, 'capa');
        if (file) { console.log(`    ✓ ${file} (cover)`); imgCount++; }
      }

      const existingImgCount = art.existingFiles.filter(f => f.startsWith('img-')).length;
      let n = existingImgCount;
      for (const [src, alt] of bodyImages) {
        const imgUrl = toArchiveImageUrl(src, capture.url);
        const file = await downloadImage(imgUrl, art.dir, `img-${String(++n).padStart(2, '0')}`);
        if (file) { console.log(`    ✓ ${file}`); imgCount++; }
      }

      if (imgCount > 0) {
        success = true;
        recovered++;
        report.push({ ...art, result: 'recovered-wayback', images: imgCount });
        console.log(`    Recovered ${imgCount} images from Wayback`);
        break;
      }
    } catch (err) {
      console.warn(`    ! ${err.message}`);
    }
  }

  if (!success) {
    failed++;
    report.push({ ...art, result: 'failed' });
    console.log('  ✗ Could not recover images from any source');
  }

  // Rate limit courtesy
  await new Promise(r => setTimeout(r, 1500));
}

// Write report
const reportPath = 'research/image-recovery-report.md';
const lines = [
  '# Image Recovery Report',
  '',
  `Date: ${new Date().toISOString().slice(0, 10)}`,
  `Total articles needing recovery: ${articles.length}`,
  `Recovered: ${recovered}`,
  `Failed: ${failed}`,
  '',
  '## Results',
  '',
];
for (const r of report) {
  const status = r.result === 'recovered' || r.result === 'recovered-wayback' ? '✓' : '✗';
  lines.push(`- ${status} **${r.title}** (${r.slug}): ${r.result}${r.images ? ` — ${r.images} images` : ''}`);
}
lines.push('');
const failedArticles = report.filter(r => r.result === 'failed' || r.result === 'no-url');
if (failedArticles.length) {
  lines.push('## Still Missing Images');
  lines.push('');
  lines.push('These articles could not have their images recovered from any web archive:');
  lines.push('');
  for (const r of failedArticles) {
    lines.push(`- **${r.title}**: ${r.originalUrl || 'no original URL'}`);
  }
}
await writeFile(reportPath, lines.join('\n') + '\n');

console.log(`\n=== Summary ===`);
console.log(`Recovered: ${recovered}/${articles.length}`);
console.log(`Failed: ${failed}/${articles.length}`);
console.log(`Report: ${reportPath}`);
