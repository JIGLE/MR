#!/usr/bin/env node
// Comprehensive search for Marlene Rendeiro articles with proper authorship verification
import { readInventory, writeInventory, COLUMNS } from './csv.mjs';
import { JSDOM, VirtualConsole } from 'jsdom';

const INVENTORY = 'research/inventory.csv';
const USER_AGENT = 'Mozilla/5.0 (arquivo pessoal; +https://github.com/JIGLE/MR)';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000), redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res;
}

function outletFor(url) {
  const { hostname, pathname } = new URL(url);
  const host = hostname.replace(/^www\./, '');
  if (host.endsWith('evasoes.pt') || (host === 'motor24.pt' && pathname.startsWith('/evasoes'))) return 'evasoes';
  if (host.endsWith('voltaaomundo.pt')) return 'volta-ao-mundo';
  if (host.endsWith('dn.pt')) return 'diario-de-noticias';
  if (host.includes('noticiastv') || host === 'nm.pt') return 'noticias-tv';
  if (host.endsWith('delas.pt')) return 'delas';
  return 'outros';
}

function isAuthor(html) {
  const authorTrack = html.match(/AuthorTracking['":\s]+['"]([^'"]+)['"]/i)?.[1];
  const globalAuthor = html.match(/globalAuthorQueryName\s*=\s*"([^"]+)"/i)?.[1];
  const metaAuthor = html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i)?.[1];
  const ldAuthor = html.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i)?.[1];
  const bylineText = html.match(/<[^>]*class="[^"]*(?:post-author|byline)[^"]*"[^>]*>\s*<[^>]*>([^<]{2,50})/i)?.[1];
  const author = authorTrack || globalAuthor || metaAuthor || ldAuthor || bylineText || '';
  return /marlene\s*rendeiro/i.test(author) || /marlene\s*r\b/i.test(author);
}

function getDate(html) {
  const published = html.match(/article:published_time["'\s]*content=["']([^"']+)/i)?.[1] ||
    html.match(/datePublished["'\s]*[:=]["'\s]*["']?(\d{4}-\d{2}-\d{2})/i)?.[1];
  if (published && !isNaN(Date.parse(published))) return new Date(published).toISOString().slice(0, 10);
  return '';
}

// Step 1: Search Arquivo.pt for articles mentioning her on each outlet
console.log('=== Step 1: Arquivo.pt full-text search ===');
const queries = [
  { q: '"Marlene Rendeiro"', sites: ['evasoes.pt', 'delas.pt', 'voltaaomundo.pt', 'motor24.pt', 'dn.pt'] },
  { q: '"Marlene R."', sites: ['evasoes.pt', 'delas.pt'] },
];

const candidates = new Map(); // url -> info

for (const { q, sites } of queries) {
  for (const site of sites) {
    const query = `${q} site:${site}`;
    try {
      const params = new URLSearchParams({ q: query, maxItems: 500, fields: 'title,originalURL,tstamp,linkToArchive' });
      const data = await (await get(`https://arquivo.pt/textsearch?${params}`)).json();
      const items = data.response_items ?? [];
      console.log(`  "${query}": ${items.length}`);
      for (const it of items) {
        if (!candidates.has(it.originalURL)) {
          candidates.set(it.originalURL, { title: it.title, url: it.originalURL, tstamp: it.tstamp, archiveUrl: it.linkToArchive });
        }
      }
    } catch (e) { console.log(`  Error: ${e.message}`); }
    await delay(800);
  }
}

// Also search without site filter
for (const q of ['"Marlene Rendeiro" evasoes', '"Marlene Rendeiro" Delas', '"Marlene Rendeiro" "Volta ao Mundo"']) {
  try {
    const params = new URLSearchParams({ q, maxItems: 500, fields: 'title,originalURL,tstamp,linkToArchive' });
    const data = await (await get(`https://arquivo.pt/textsearch?${params}`)).json();
    const items = data.response_items ?? [];
    console.log(`  "${q}": ${items.length}`);
    for (const it of items) {
      if (!candidates.has(it.originalURL)) {
        candidates.set(it.originalURL, { title: it.title, url: it.originalURL, tstamp: it.tstamp, archiveUrl: it.linkToArchive });
      }
    }
  } catch (e) { console.log(`  Error: ${e.message}`); }
  await delay(800);
}

console.log(`\nTotal unique candidate URLs: ${candidates.size}`);

// Step 2: Filter to article-looking URLs on her outlets
const herDomains = ['evasoes.pt', 'delas.pt', 'voltaaomundo.pt', 'dn.pt', 'motor24.pt', 'jn.pt'];
const articles = [];
for (const [url, info] of candidates) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const path = new URL(url).pathname;
    if (!herDomains.some(d => host.endsWith(d))) continue;
    if (path === '/' || /\/(author|autor|autores|tag|category|page|search)\b/.test(path)) continue;
    if (path.split('/').filter(Boolean).length < 2) continue;
    if (url.endsWith('/amp') || url.endsWith('/amp/') || url.includes('ia_markup')) continue;
    articles.push(info);
  } catch {}
}
console.log(`Article-looking URLs to verify: ${articles.length}`);

// Step 3: Verify authorship
console.log('\n=== Step 2: Verifying authorship ===');
const rows = await readInventory(INVENTORY);
const existingUrls = new Set(rows.map(r => r.url));
let verified = 0, confirmed = 0, newAdded = 0;

for (const info of articles) {
  const rawUrl = `https://arquivo.pt/noFrame/replay/${info.tstamp}id_/${info.url}`;
  try {
    const res = await fetch(rawUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) { verified++; continue; }
    const html = await res.text();

    if (isAuthor(html)) {
      confirmed++;
      const date = getDate(html);
      const archiveUrl = info.archiveUrl;

      if (existingUrls.has(info.url)) {
        // Update existing row
        const row = rows.find(r => r.url === info.url);
        if (row && row.status !== 'importado') {
          row.status = 'importar';
          if (!row.archive_url) row.archive_url = archiveUrl;
          if (!row.date && date) row.date = date;
        }
      } else {
        // Add new row
        rows.push({
          title: info.title || '', outlet: outletFor(info.url), date,
          url: info.url, archive_url: archiveUrl, source: 'arquivo.pt (verified)',
          status: 'importar', notes: 'byline confirmada'
        });
        existingUrls.add(info.url);
        newAdded++;
      }
      console.log(`  ✓ ${date || '????'} | ${outletFor(info.url)} | ${info.title?.slice(0,55)}`);
    }
  } catch {}

  verified++;
  if (verified % 20 === 0) {
    console.log(`  ... ${verified}/${articles.length} (${confirmed} confirmed)`);
    await writeInventory(INVENTORY, rows);
  }
  await delay(400);
}

// Step 4: Check Wayback author page captures for additional leads
console.log('\n=== Step 3: Wayback author pages ===');
const authorPages = [
  'evasoes.pt/author/marlene-rendeiro/',
  'evasoes.pt/autor/marlene-rendeiro/',
  'delas.pt/author/marlene-rendeiro/',
  'delas.pt/autor/marlene-rendeiro/',
  'motor24.pt/evasoes/author/marlene-rendeiro/',
];

for (const page of authorPages) {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${page}&output=json&filter=statuscode:200&collapse=timestamp:8&fl=timestamp,original`;
  try {
    const data = await (await get(cdxUrl)).json();
    const captures = data.slice(1);
    console.log(`  ${page}: ${captures.length} captures`);

    for (const [ts, orig] of captures) {
      const captureUrl = `https://web.archive.org/web/${ts}id_/${orig}`;
      try {
        const html = await (await get(captureUrl)).text();
        const doc = new JSDOM(html, { url: `https://${orig}`, virtualConsole: new VirtualConsole() }).window.document;
        const host = new URL(`https://${orig}`).hostname.replace(/^www\./, '');

        for (const a of doc.querySelectorAll('a[href]')) {
          let href = a.href.replace(/^https?:\/\/(web\.archive\.org\/web)\/\d+[a-z_]*\//, '');
          let u;
          try { u = new URL(href); } catch { continue; }
          if (u.hostname.replace(/^www\./, '') !== host) continue;
          const path = u.pathname;
          if (path.split('/').filter(Boolean).length < 2) continue;
          if (/\/(author|autor|tag|category|page|search)\b/.test(path)) continue;
          if (path.endsWith('/amp') || path.endsWith('/amp/')) continue;

          const articleUrl = u.origin + path;
          if (existingUrls.has(articleUrl)) continue;
          existingUrls.add(articleUrl);

          const text = a.textContent.trim().replace(/\s+/g, ' ');
          rows.push({
            title: text, outlet: outletFor(articleUrl), date: '',
            url: articleUrl, archive_url: '', source: `wayback author page (${ts.slice(0,8)})`,
            status: 'importar', notes: 'listada na página de autora - verificar byline'
          });
          newAdded++;
          console.log(`    + ${text?.slice(0,60) || articleUrl}`);
        }
      } catch (e) { console.log(`    ! ${e.message}`); }
      await delay(1000);
    }
  } catch (e) { console.log(`  ! ${page}: ${e.message}`); }
  await delay(500);
}

rows.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.url.localeCompare(b.url));
await writeInventory(INVENTORY, rows);

const importar = rows.filter(r => r.status === 'importar').length;
console.log(`\n=== Summary ===`);
console.log(`Verified: ${verified}, Confirmed author: ${confirmed}, New rows added: ${newAdded}`);
console.log(`Total to import: ${importar}`);
