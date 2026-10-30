#!/usr/bin/env node
// Imports every row of research/inventory.csv whose status is "importar", one by one, with
// `npm run import`. Uses the archive capture when there is one (it has the images as published),
// otherwise the live page. Each row's status becomes "importado" or "erro" (reason in notes).
//
//   npm run import-list [-- --dry-run]
import { spawnSync } from 'node:child_process';
import { readInventory, writeInventory } from './csv.mjs';
import { parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const INVENTORY = 'research/inventory.csv';
const rows = await readInventory(INVENTORY);
const todo = rows.filter((r) => r.status === 'importar');
console.log(`${todo.length} artigos para importar.`);

for (const row of todo) {
  const source = row.archive_url || row.url;
  const cmd = ['scripts/import-url.mjs', source, '--outlet', row.outlet || 'outros'];
  if (row.date) cmd.push('--date', row.date);
  console.log(`\n→ ${row.title || source}`);
  if (args['dry-run']) { console.log(`  node ${cmd.join(' ')}`); continue; }
  const res = spawnSync('node', cmd, { stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf8' });
  if (res.status === 0) row.status = 'importado';
  else {
    row.status = 'erro';
    row.notes = [row.notes, (res.stderr || '').trim().split('\n').pop()].filter(Boolean).join(' | ');
    console.error(`  ✗ ${res.stderr.trim()}`);
  }
  await writeInventory(INVENTORY, rows); // save after each one, so an interruption loses nothing
}
