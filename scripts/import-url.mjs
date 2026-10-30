#!/usr/bin/env node
// Imports one article from the web (live site, Arquivo.pt or the Wayback Machine) or from an
// HTML file saved in the browser. It keeps everything needed to never depend on the original site:
//   - the text, converted to Markdown, in index.md
//   - every image in the article body, downloaded next to it (img-01.jpg, …) with captions
//   - the cover image (og:image) as capa.<ext>
//   - snapshot.html: the full original page, scripts removed, images embedded
//
//   npm run import -- <url> --outlet evasoes [--date 2018-05-12] [--tags "Viagens, Portugal"]
//   npm run import -- --file pagina.html --url <original url> --outlet dn
//
// Always review the result: automatic extraction can miss captions, boxes or galleries.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { createArticleDir, parseArgs, writeArticle } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const sourceUrl = args._[0] ?? args.url;
if (!sourceUrl || !args.outlet) {
  console.error('Uso: npm run import -- <url> --outlet <id> [--date AAAA-MM-DD] [--tags "a, b"] [--file pagina.html]');
  process.exit(1);
}

const USER_AGENT = 'Mozilla/5.0 (arquivo pessoal; +https://github.com/JIGLE/MR)';

/** Recognises Arquivo.pt and Wayback URLs and returns the raw-capture URL plus the original address. */
function archiveInfo(url) {
  const m = url.match(/^(https?:\/\/(?:arquivo\.pt\/wayback|web\.archive\.org\/web))\/(\d{8,14})(?:[a-z_]{2,3}_)?\/(.+)$/);
  if (!m) return null;
  const [, base, timestamp, original] = m;
  // The `id_` flag asks the archive for the page exactly as captured, without its toolbar.
  return { raw: `${base}/${timestamp}id_/${original}`, original, timestamp, archiveUrl: `${base}/${timestamp}/${original}`, base };
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ao descarregar ${url}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '' };
}

/** Images inside an archived page should also come from the archive, from the same capture. */
function assetUrl(src, pageUrl, archive) {
  const abs = new URL(src, pageUrl).href;
  if (!archive || abs.startsWith(archive.base)) return abs;
  return `${archive.base}/${archive.timestamp}im_/${abs}`;
}

const extFromType = (type) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg' })[type.split(';')[0].trim()];
const extFromUrl = (url) => (new URL(url).pathname.match(/\.(jpe?g|png|webp|gif|avif|svg)$/i)?.[1] ?? '').toLowerCase().replace('jpeg', 'jpg');

/** Picks the largest candidate from srcset / lazy-loading attributes. */
function bestSource(img) {
  const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
  if (srcset) {
    const candidates = srcset.split(',').map((c) => c.trim().split(/\s+/)).map(([u, w]) => [u, parseFloat(w) || 1]);
    candidates.sort((a, b) => b[1] - a[1]);
    if (candidates[0]?.[0]) return candidates[0][0];
  }
  return img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || img.getAttribute('src');
}

function meta(doc, ...names) {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`);
    if (el?.getAttribute('content')) return el.getAttribute('content').trim();
  }
}

// --- 1. Load the page --------------------------------------------------------------------------
const archive = archiveInfo(sourceUrl);
const originalUrl = archive ? archive.original : sourceUrl;
const pageUrl = archive ? archive.raw : sourceUrl;
const html = args.file
  ? await readFile(args.file, 'utf8')
  : (await fetchBuffer(pageUrl)).buffer.toString('utf8');

const virtualConsole = new VirtualConsole(); // silence CSS parse noise from real-world pages
const dom = new JSDOM(html, { url: pageUrl, virtualConsole });
const doc = dom.window.document;

// --- 2. Metadata -------------------------------------------------------------------------------
const published = meta(doc, 'article:published_time', 'datePublished', 'date', 'DC.date.issued', 'pubdate');
const date =
  args.date ??
  (published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString().slice(0, 10) : undefined) ??
  (archive ? `${archive.timestamp.slice(0, 4)}-${archive.timestamp.slice(4, 6)}-${archive.timestamp.slice(6, 8)}` : undefined);
if (!date) {
  console.error('Não encontrei a data de publicação. Indique-a com --date AAAA-MM-DD.');
  process.exit(1);
}
const section = meta(doc, 'article:section');
const ogImage = meta(doc, 'og:image', 'twitter:image');

// --- 3. Extract the article body ---------------------------------------------------------------
// Readability mutates the document, so it works on a clone; the original is kept for the snapshot.
const article = new Readability(doc.cloneNode(true), { keepClasses: false, charThreshold: 200 }).parse();
if (!article) {
  console.error('Não consegui identificar o texto do artigo nesta página. Experimente guardar a página e criar o artigo à mão (npm run new).');
  process.exit(1);
}
const title = args.title ?? meta(doc, 'og:title') ?? article.title;
const dir = await createArticleDir(date, title);
const body = new JSDOM(`<body>${article.content}</body>`, { url: pageUrl }).window.document.body;

// --- 4. Download images ------------------------------------------------------------------------
const downloaded = new Map(); // absolute url -> { file, dataUri }
let n = 0;
async function download(src, baseName) {
  const url = assetUrl(src, pageUrl, archive);
  if (downloaded.has(url)) return downloaded.get(url);
  try {
    const { buffer, type } = await fetchBuffer(url);
    const ext = extFromType(type) || extFromUrl(url) || 'jpg';
    const file = `${baseName}.${ext}`;
    await writeFile(join(dir, file), buffer);
    const entry = { file, dataUri: `data:${type.split(';')[0] || 'image/' + ext};base64,${buffer.toString('base64')}` };
    downloaded.set(url, entry);
    return entry;
  } catch (err) {
    console.warn(`  ! imagem não descarregada: ${url} (${err.message})`);
    return null;
  }
}

for (const img of body.querySelectorAll('img')) {
  const src = bestSource(img);
  if (!src || src.startsWith('data:')) continue;
  const saved = await download(src, `img-${String(++n).padStart(2, '0')}`);
  if (saved) {
    img.setAttribute('src', `./${saved.file}`);
    for (const a of ['srcset', 'data-src', 'data-srcset', 'sizes', 'loading']) img.removeAttribute(a);
    console.log(`  ✓ ${saved.file}`);
  }
}
const cover = ogImage ? await download(ogImage, 'capa') : null;
if (cover) console.log(`  ✓ ${cover.file} (capa)`);

// --- 5. Convert to Markdown --------------------------------------------------------------------
const turndown = new TurndownService({ headingStyle: 'atx', emDelimiter: '*', bulletListMarker: '-' });
// Keep embeds (YouTube, maps, social posts…) as raw HTML so they still render.
turndown.keep(['iframe', 'video', 'audio', 'table']);
// Figures become an image followed by its caption in italics.
turndown.addRule('figure', {
  filter: 'figure',
  replacement: (_content, node) => {
    const img = node.querySelector('img');
    const caption = node.querySelector('figcaption')?.textContent.trim();
    if (!img) return `\n\n${_content}\n\n`;
    const alt = (img.getAttribute('alt') || caption || '').replace(/[\[\]]/g, '');
    return `\n\n![${alt}](${img.getAttribute('src')})\n${caption ? `\n*${caption}*\n` : ''}\n`;
  },
});
let markdown = turndown.turndown(body.innerHTML);
// Images that could not be downloaded still point at the web; flag them for review.
markdown = markdown.replace(/!\[([^\]]*)\]\((https?:[^)]+)\)/g, '<!-- REVER: imagem não guardada localmente -->\n![$1]($2)');

// --- 6. Snapshot of the full page --------------------------------------------------------------
for (const el of doc.querySelectorAll('script, noscript, iframe[src*="ads"], link[rel="preload"], link[rel="prefetch"]')) el.remove();
for (const el of doc.querySelectorAll('[onload], [onclick], [onerror]')) {
  for (const a of ['onload', 'onclick', 'onerror']) el.removeAttribute(a);
}
for (const img of doc.querySelectorAll('img')) {
  const src = bestSource(img);
  const saved = src && downloaded.get(assetUrl(src, pageUrl, archive));
  if (saved) {
    img.setAttribute('src', saved.dataUri);
    for (const a of ['srcset', 'data-src', 'data-srcset', 'loading']) img.removeAttribute(a);
  }
}
// Anything not embedded (stylesheets, fonts) still loads from the original address while it exists.
const base = doc.createElement('base');
base.href = archive ? archive.archiveUrl : originalUrl;
doc.head.prepend(base);
const banner = `<!-- Cópia guardada em ${new Date().toISOString()} a partir de ${sourceUrl} -->\n`;
await writeFile(join(dir, 'snapshot.html'), banner + dom.serialize());

// --- 7. Write index.md -------------------------------------------------------------------------
const tags = typeof args.tags === 'string' ? args.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
await writeArticle(
  dir,
  {
    title,
    subtitle: meta(doc, 'og:description', 'description') ?? article.excerpt,
    outlet: args.outlet,
    date,
    section,
    tags,
    originalUrl,
    archiveUrl: archive?.archiveUrl,
    medium: 'web',
    cover: cover ? `./${cover.file}` : undefined,
    attachments: [{ file: './snapshot.html', label: 'Cópia da página como foi publicada' }],
  },
  markdown,
);

console.log(`\nImportado para ${dir}/index.md`);
console.log('Reveja o texto, as legendas e os temas, e corra `npm run dev` para ver o resultado.');
