#!/usr/bin/env node
// Verifies "por-verificar" rows in inventory.csv by checking if Marlene Rendeiro's byline
// appears on the page. Uses archive captures when available, falls back to live pages.
//
//   node scripts/verify.mjs [--limit 100] [--domain evasoes.pt]
import { readInventory, writeInventory } from './csv.mjs';
import { parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const INVENTORY = 'research/inventory.csv';
const USER_AGENT = 'Mozilla/5.0 (arquivo pessoal; +https://github.com/JIGLE/MR)';
const LIMIT = parseInt(args.limit) || 999999;
const DOMAIN = args.domain || '';
const BYLINE_PATTERNS = [
  /marlene\s+rendeiro/i,
  /marlene\s+r\./i,
  /por\s+marlene/i,
  /by\s+marlene\s+rendeiro/i,
];

const rows = await readInventory(INVENTORY);

// First pass: mark obvious non-articles as "não" without fetching
let skipped = 0;
for (const row of rows) {
  if (row.status !== 'por-verificar') continue;
  const u = row.url;
  // Skip non-article URLs
  if (/\/(author|autor|autores|categoria|categorias|category|tag|tags|page|pesquisa|search)\b/.test(u) && !/-[a-z]/.test(u.split('/').pop())) {
    row.status = 'não'; row.notes = 'página de listagem, não artigo'; skipped++; continue;
  }
  if (/\/(ficha-tecnica|estatuto-editorial|termos-e-privacidade|politica-de-privacidade)\b/i.test(u)) {
    row.status = 'não'; row.notes = 'página institucional'; skipped++; continue;
  }
  // Homepage
  if (new URL(u).pathname === '/' || new URL(u).pathname === '') {
    row.status = 'não'; row.notes = 'homepage'; skipped++; continue;
  }
  // AMP duplicates - if the non-amp version is already in inventory, skip
  if (u.endsWith('/amp') || u.endsWith('/amp/') || u.includes('/amp?')) {
    const base = u.replace(/\/amp\/?(\?.*)?$/, '');
    if (rows.some(r => r.url === base || r.url === base + '/')) {
      row.status = 'não'; row.notes = 'duplicado AMP'; skipped++; continue;
    }
  }
  // ia_markup duplicates
  if (u.includes('ia_markup=1')) {
    const base = u.replace(/[?&]ia_markup=1/, '').replace(/\?$/, '');
    if (rows.some(r => r.url === base || r.url === base + '/')) {
      row.status = 'não'; row.notes = 'duplicado ia_markup'; skipped++; continue;
    }
  }
  // Clearly unrelated domains
  const host = new URL(u).hostname.replace(/^www\./, '');
  const unrelated = ['academia.edu', 'scribd.com', 'blogspot.com', 'blueflag.global', 'peticaopublica.com',
    'repositorio.uac.pt', 'srec.azores.gov.pt', 'capitalberg.com', 'teloos.com.pt', 'esparedes.pt',
    'linguagista.blogs.sapo.pt', 'entretenimento.pt.msn.com', 'altishotels.com', 'cdn.ampproject.org'];
  if (unrelated.some(d => host === d || host.endsWith('.' + d))) {
    row.status = 'não'; row.notes = 'domínio sem relação'; skipped++; continue;
  }
}
console.log(`${skipped} marcados como "não" sem fetch (listagens, duplicados, domínios irrelevantes)`);

// Second pass: fetch and check byline on remaining por-verificar rows
const todo = rows.filter(r => r.status === 'por-verificar' && (!DOMAIN || r.url.includes(DOMAIN)));
console.log(`${todo.length} por verificar${DOMAIN ? ` (filtro: ${DOMAIN})` : ''}, limite: ${LIMIT}`);

let verified = 0, confirmed = 0, rejected = 0, errors = 0;
for (const row of todo.slice(0, LIMIT)) {
  const fetchUrl = row.archive_url || row.url;
  try {
    const res = await fetch(fetchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
      redirect: 'follow',
    });
    if (!res.ok) {
      // Try Arquivo.pt if live page fails
      if (!row.archive_url) {
        const arqUrl = `https://arquivo.pt/wayback/20200101000000id_/${row.url}`;
        try {
          const arqRes = await fetch(arqUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
          if (arqRes.ok) {
            const html = await arqRes.text();
            if (BYLINE_PATTERNS.some(p => p.test(html))) {
              row.status = 'importar';
              row.archive_url = arqUrl.replace('id_/', '/');
              confirmed++;
            } else {
              row.status = 'não';
              row.notes = [row.notes, 'byline ausente (arquivo.pt)'].filter(Boolean).join(' | ');
              rejected++;
            }
            verified++;
            continue;
          }
        } catch {}
      }
      row.status = 'erro';
      row.notes = [row.notes, `${res.status}`].filter(Boolean).join(' | ');
      errors++;
      verified++;
      continue;
    }
    const html = await res.text();
    if (BYLINE_PATTERNS.some(p => p.test(html))) {
      row.status = 'importar';
      confirmed++;
    } else {
      row.status = 'não';
      row.notes = [row.notes, 'byline ausente'].filter(Boolean).join(' | ');
      rejected++;
    }
  } catch (err) {
    row.status = 'erro';
    row.notes = [row.notes, err.message?.slice(0, 80)].filter(Boolean).join(' | ');
    errors++;
  }
  verified++;
  if (verified % 25 === 0) {
    console.log(`  ${verified}/${Math.min(todo.length, LIMIT)} verificados (${confirmed} sim, ${rejected} não, ${errors} erros)`);
    await writeInventory(INVENTORY, rows);
  }
}
await writeInventory(INVENTORY, rows);
console.log(`\nResultado: ${confirmed} confirmados, ${rejected} rejeitados, ${errors} erros`);
console.log(`Total: ${rows.filter(r=>r.status==='importar').length} para importar`);
