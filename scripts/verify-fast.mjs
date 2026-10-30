#!/usr/bin/env node
// Fast verification: eliminates unrelated domains, deduplicates, and checks bylines
// on archive captures for the domains where Marlene Rendeiro wrote.
import { readInventory, writeInventory } from './csv.mjs';
import { parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const INVENTORY = 'research/inventory.csv';
const USER_AGENT = 'Mozilla/5.0 (arquivo pessoal; +https://github.com/JIGLE/MR)';
const BYLINE_PATTERNS = [
  /marlene\s+rendeiro/i,
  /por\s+marlene\s+r\b/i,
];

// Her outlets
const HER_DOMAINS = ['evasoes.pt', 'jn.pt', 'dn.pt', 'delas.pt', 'voltaaomundo.pt', 'motor24.pt',
  'noticiastv.pt', 'nm.pt', 'vdigital.pt', 'ocio.dn.pt', 'qua.jn.pt', 'm.jn.pt'];

const rows = await readInventory(INVENTORY);

// Phase 1: eliminate non-her domains
let eliminated = 0;
for (const row of rows) {
  if (row.status !== 'por-verificar') continue;
  let host;
  try { host = new URL(row.url).hostname.replace(/^www\./, ''); } catch { row.status = 'não'; eliminated++; continue; }

  if (!HER_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
    // Check if the path contains evasoes section on jn.pt
    if (host === 'jn.pt' || host === 'm.jn.pt' || host === 'qua.jn.pt') {
      const path = new URL(row.url).pathname;
      // jn.pt articles that aren't in evasoes/volta-ao-mundo sections are probably not hers
      if (!/\/(evasoes|volta-ao-mundo|delas|viagens)\b/.test(path)) {
        row.status = 'não'; row.notes = [row.notes, 'secção JN não relacionada'].filter(Boolean).join(' | ');
        eliminated++; continue;
      }
    } else {
      row.status = 'não'; row.notes = [row.notes, 'domínio fora dos outlets'].filter(Boolean).join(' | ');
      eliminated++; continue;
    }
  }

  // JN articles not in her sections
  if ((host === 'jn.pt' || host === 'm.jn.pt') && !/\/(evasoes|volta-ao-mundo|delas|viagens)\b/.test(new URL(row.url).pathname)) {
    row.status = 'não'; row.notes = [row.notes, 'secção JN não relacionada'].filter(Boolean).join(' | ');
    eliminated++; continue;
  }

  // Obvious non-articles
  const path = new URL(row.url).pathname;
  if (path === '/' || path === '') { row.status = 'não'; row.notes = 'homepage'; eliminated++; continue; }
  if (/\/(author|autor|autores|categoria|categorias|category|tag|tags)\b/.test(path)) {
    row.status = 'não'; row.notes = 'página de listagem'; eliminated++; continue;
  }
  if (/\/(ficha-tecnica|estatuto-editorial|termos|privacidade|contactos|equipa|sobre)\b/i.test(path)) {
    row.status = 'não'; row.notes = 'página institucional'; eliminated++; continue;
  }
}

// Phase 2: deduplicate - keep the best URL for each article slug
const seen = new Map();
for (const row of rows) {
  if (row.status === 'não') continue;
  const path = new URL(row.url).pathname.replace(/\/amp\/?$/, '').replace(/\?.*$/, '').replace(/\/$/, '');
  const slug = path.split('/').pop();
  if (!slug || slug.length < 5) continue;
  const key = slug;
  if (seen.has(key)) {
    const existing = seen.get(key);
    // Prefer evasoes.pt over motor24.pt, prefer non-amp, prefer with archive_url
    if (row.status === 'por-verificar' && existing.status !== 'por-verificar') continue;
    const score = (r) => {
      let s = 0;
      if (r.url.includes('evasoes.pt')) s += 10;
      if (r.archive_url) s += 5;
      if (!r.url.includes('/amp')) s += 2;
      if (!r.url.includes('ia_markup')) s += 1;
      return s;
    };
    if (score(row) <= score(existing)) {
      if (row.status === 'por-verificar') { row.status = 'não'; row.notes = 'duplicado'; eliminated++; }
    } else {
      if (existing.status === 'por-verificar') { existing.status = 'não'; existing.notes = 'duplicado'; eliminated++; }
      seen.set(key, row);
    }
  } else {
    seen.set(key, row);
  }
}

await writeInventory(INVENTORY, rows);
const remaining = rows.filter(r => r.status === 'por-verificar').length;
console.log(`Phase 1-2: ${eliminated} eliminados. ${remaining} por verificar.`);

// Phase 3: verify bylines by fetching archive captures
const todo = rows.filter(r => r.status === 'por-verificar');
console.log(`Verificando ${todo.length} artigos via fetch...`);

let verified = 0, confirmed = 0, rejected = 0, errors = 0;
const CONCURRENCY = 5;
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function verifyRow(row) {
  const fetchUrl = row.archive_url || `https://arquivo.pt/noFrame/replay/${row.url}`;
  try {
    const res = await fetch(fetchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
      redirect: 'follow',
    });
    if (!res.ok) {
      // Try the live URL
      try {
        const liveRes = await fetch(row.url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000), redirect: 'follow' });
        if (liveRes.ok) {
          const html = await liveRes.text();
          if (BYLINE_PATTERNS.some(p => p.test(html))) { row.status = 'importar'; confirmed++; }
          else { row.status = 'não'; row.notes = [row.notes, 'byline ausente'].filter(Boolean).join(' | '); rejected++; }
          return;
        }
      } catch {}
      row.status = 'erro'; row.notes = [row.notes, `${res.status}`].filter(Boolean).join(' | '); errors++;
      return;
    }
    const html = await res.text();
    if (BYLINE_PATTERNS.some(p => p.test(html))) {
      row.status = 'importar';
      if (!row.archive_url && fetchUrl.includes('arquivo.pt')) {
        row.archive_url = fetchUrl;
      }
      confirmed++;
    } else {
      row.status = 'não'; row.notes = [row.notes, 'byline ausente'].filter(Boolean).join(' | '); rejected++;
    }
  } catch (err) {
    row.status = 'erro'; row.notes = [row.notes, err.message?.slice(0, 60)].filter(Boolean).join(' | '); errors++;
  }
}

// Process in batches
for (let i = 0; i < todo.length; i += CONCURRENCY) {
  const batch = todo.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(r => verifyRow(r)));
  verified += batch.length;
  if (verified % 25 === 0 || i + CONCURRENCY >= todo.length) {
    console.log(`  ${verified}/${todo.length} (${confirmed} sim, ${rejected} não, ${errors} erros)`);
    await writeInventory(INVENTORY, rows);
  }
  await delay(200);
}

await writeInventory(INVENTORY, rows);
console.log(`\nDone: ${confirmed} confirmados, ${rejected} rejeitados, ${errors} erros`);
console.log(`Total para importar: ${rows.filter(r=>r.status==='importar').length}`);
