#!/usr/bin/env node
// Retries 'erro' rows and re-checks key evasoes.pt/dn.pt articles via Arquivo.pt with rate limiting.
// Also normalizes duplicate URLs (amp, trailing slashes, etc.)
import { readInventory, writeInventory } from './csv.mjs';
import { parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const INVENTORY = 'research/inventory.csv';
const USER_AGENT = 'Mozilla/5.0 (arquivo pessoal; +https://github.com/JIGLE/MR)';
const BYLINE_PATTERNS = [/marlene\s+rendeiro/i, /por\s+marlene\s+r\b/i];
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const rows = await readInventory(INVENTORY);

// Retry all 'erro' rows from rate limiting
const retries = rows.filter(r => r.status === 'erro' && r.notes?.includes('429'));
console.log(`${retries.length} artigos com erro 429 para re-verificar`);

let confirmed = 0, rejected = 0, stillError = 0;
for (let i = 0; i < retries.length; i++) {
  const row = retries[i];
  const fetchUrl = row.archive_url || row.url;
  try {
    const res = await fetch(fetchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
      redirect: 'follow',
    });
    if (res.status === 429) {
      console.log(`  429 at ${i+1}/${retries.length}, waiting 30s...`);
      await delay(30000);
      stillError++;
      continue;
    }
    if (!res.ok) { stillError++; continue; }
    const html = await res.text();
    if (BYLINE_PATTERNS.some(p => p.test(html))) {
      row.status = 'importar';
      confirmed++;
      console.log(`  ✓ ${row.title?.slice(0,60) || row.url}`);
    } else {
      row.status = 'não';
      row.notes = row.notes?.replace('429', 'byline ausente');
      rejected++;
    }
  } catch (err) {
    stillError++;
  }
  if ((i+1) % 10 === 0) {
    await writeInventory(INVENTORY, rows);
    console.log(`  ${i+1}/${retries.length} (${confirmed} sim, ${rejected} não, ${stillError} erros)`);
  }
  await delay(1500); // 1.5s between requests to avoid rate limiting
}

await writeInventory(INVENTORY, rows);
console.log(`\nRetries: ${confirmed} confirmados, ${rejected} rejeitados, ${stillError} ainda erros`);
console.log(`Total para importar: ${rows.filter(r=>r.status==='importar').length}`);
