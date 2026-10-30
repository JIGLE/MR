// Minimal CSV reading/writing for research/inventory.csv (RFC 4180 quoting, comma separated).
import { readFile, writeFile } from 'node:fs/promises';

export const COLUMNS = ['title', 'outlet', 'date', 'url', 'archive_url', 'source', 'status', 'notes'];

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.some(Boolean));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const cell = (v) => (/[",\n]/.test(v ?? '') ? `"${String(v).replace(/"/g, '""')}"` : (v ?? ''));

export async function readInventory(path) {
  try { return parseCsv(await readFile(path, 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
}

export async function writeInventory(path, rows) {
  const lines = [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))];
  await writeFile(path, lines.join('\n') + '\n');
}
