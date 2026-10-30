#!/usr/bin/env node
// Looks for articles signed by Marlene Rendeiro and adds them to research/inventory.csv.
// Rows already in the inventory are kept as they are (including their status and notes).
//
//   npm run discover                     # all sources
//   npm run discover -- --only arquivo   # one source: arquivo, wayback or live
//   npm run discover -- --name "Outro Nome"
//
// Sources:
//   arquivo  Arquivo.pt full-text search (the best source for Portuguese media, 1996 onwards)
//   wayback  Wayback Machine captures of her author pages, and the article links on them
//   live     Her author pages on the outlets' current sites, page by page
//
// What it finds are leads: check each one has her byline before importing (npm run import-list).
import { readInventory, writeInventory } from './csv.mjs';
import { parseArgs } from './lib.mjs';
import { JSDOM, VirtualConsole } from 'jsdom';

const args = parseArgs(process.argv.slice(2));
const NAME = typeof args.name === 'string' ? args.name : 'Marlene Rendeiro';
const SLUG = NAME.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
const INVENTORY = 'research/inventory.csv';
const USER_AGENT = 'Mozilla/5.0 (arquivo pessoal; +https://github.com/JIGLE/MR)';

// Author pages to look at, on the live sites and in the Wayback Machine.
const AUTHOR_PAGES = [
  `evasoes.pt/author/${SLUG}/`,
  `evasoes.pt/autor/${SLUG}/`,
  `voltaaomundo.pt/author/${SLUG}/`,
  `voltaaomundo.pt/autor/${SLUG}/`,
  `noticiastv.pt/author/${SLUG}/`,
  `nm.pt/author/${SLUG}/`,
  `dn.pt/autor/${SLUG}.html`,
  `dn.pt/autores/${SLUG}.html`,
  `motor24.pt/author/${SLUG}/`,
];

export function outletFor(url) {
  const { hostname, pathname } = new URL(url);
  const host = hostname.replace(/^www\./, '');
  if (host.endsWith('evasoes.pt') || (host === 'motor24.pt' && pathname.startsWith('/evasoes'))) return 'evasoes';
  if (host.endsWith('voltaaomundo.pt')) return 'volta-ao-mundo';
  if (host.endsWith('dn.pt')) return 'diario-de-noticias';
  if (host.includes('noticiastv') || host === 'nm.pt') return 'noticias-tv';
  return 'outros';
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}

const ymd = (ts) => (ts ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : '');

// --- Arquivo.pt full-text search ---------------------------------------------------------------
// https://github.com/arquivo/pwa-technologies/wiki/Arquivo.pt-API
async function* arquivo() {
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const q = new URLSearchParams({ q: `"${NAME}"`, maxItems: pageSize, offset, fields: 'title,originalURL,tstamp,linkToArchive' });
    const data = await (await get(`https://arquivo.pt/textsearch?${q}`)).json();
    const items = data.response_items ?? [];
    for (const it of items) {
      yield { title: it.title, url: it.originalURL, date: '', archive_url: it.linkToArchive, source: 'arquivo.pt', notes: `captura ${ymd(it.tstamp)}` };
    }
    if (items.length < pageSize) return;
  }
}

/** Article-looking links on an author page: same site, not navigation, tags or other listings. */
function articleLinks(html, pageUrl) {
  const doc = new JSDOM(html, { url: pageUrl, virtualConsole: new VirtualConsole() }).window.document;
  const host = new URL(pageUrl.replace(/^.*?\/(https?:\/\/)/, '$1')).hostname.replace(/^www\./, '');
  const seen = new Map();
  for (const a of doc.querySelectorAll('a[href]')) {
    let href = a.href.replace(/^https?:\/\/(arquivo\.pt\/wayback|web\.archive\.org\/web)\/\d+[a-z_]*\//, '');
    let u;
    try { u = new URL(href); } catch { continue; }
    if (u.hostname.replace(/^www\./, '') !== host) continue;
    const path = u.pathname;
    if (path.split('/').filter(Boolean).length < 1 || /\/(author|autor|autores|categoria|categorias|category|tag|tags|page|pesquisa|search)\b/.test(path)) continue;
    if (!/-[a-z0-9]+-[a-z0-9]+/.test(path)) continue; // article slugs have several words
    const text = a.textContent.trim().replace(/\s+/g, ' ');
    const url = u.origin + path;
    if (!seen.has(url) || text.length > seen.get(url).length) seen.set(url, text);
  }
  return [...seen];
}

// --- Wayback Machine ---------------------------------------------------------------------------
async function* wayback() {
  for (const page of AUTHOR_PAGES) {
    const q = new URLSearchParams({ url: `${page}*`, output: 'json', filter: 'statuscode:200', collapse: 'urlkey', fl: 'timestamp,original' });
    let rows;
    try { rows = (await (await get(`https://web.archive.org/cdx/search/cdx?${q}`)).json()).slice(1); }
    catch (err) { console.warn(`  ! wayback ${page}: ${err.message}`); continue; }
    for (const [timestamp, original] of rows) {
      const capture = `https://web.archive.org/web/${timestamp}id_/${original}`;
      try {
        const html = await (await get(capture)).text();
        for (const [url, title] of articleLinks(html, original)) {
          yield { title, url, date: '', archive_url: '', source: `wayback: ${original}`, notes: `listado na página de autora (${ymd(timestamp)})` };
        }
      } catch (err) { console.warn(`  ! ${capture}: ${err.message}`); }
    }
  }
}

// --- Live author pages -------------------------------------------------------------------------
async function* live() {
  for (const page of AUTHOR_PAGES) {
    for (let n = 1; n <= 200; n++) {
      const url = n === 1 ? `https://www.${page}` : `https://www.${page}page/${n}/`;
      let html;
      try { html = await (await get(url)).text(); } catch { break; }
      const links = articleLinks(html, url);
      if (!links.length) break;
      for (const [link, title] of links) yield { title, url: link, date: '', archive_url: '', source: `site: ${url}`, notes: '' };
      if (page.endsWith('.html')) break;
    }
  }
}

const sources = { arquivo, wayback, live };
const chosen = args.only ? [args.only] : Object.keys(sources);
const rows = await readInventory(INVENTORY);
const known = new Set(rows.flatMap((r) => [r.url, r.archive_url]).filter(Boolean));
let added = 0;
for (const name of chosen) {
  console.log(`\n${name}…`);
  try {
    for await (const lead of sources[name]()) {
      if (!lead.url || known.has(lead.url)) continue;
      known.add(lead.url);
      const m = lead.url.match(/\/(20\d\d)\/(\d\d)\/(\d\d)\//);
      rows.push({ outlet: outletFor(lead.url), status: 'por-verificar', ...lead, date: lead.date || (m ? `${m[1]}-${m[2]}-${m[3]}` : '') });
      added++;
      console.log(`  + ${lead.title || lead.url}`);
    }
  } catch (err) {
    console.warn(`  ! ${name}: ${err.message}`);
  }
}
rows.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.url.localeCompare(b.url));
await writeInventory(INVENTORY, rows);
console.log(`\n${added} novos, ${rows.length} no total → ${INVENTORY}`);
console.log('Marque como "importar" na coluna status os que forem dela, e corra `npm run import-list`.');
