import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export const ARTICLES_DIR = 'src/content/articles';

export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/** Minimal `--key value` / `--flag` parser. Positional arguments go in `_`. */
export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { args._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

const yamlString = (s) => JSON.stringify(String(s)); // JSON strings are valid YAML

export function frontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) { lines.push(`${key}: []`); continue; }
      if (typeof value[0] === 'object') {
        lines.push(`${key}:`);
        for (const item of value) {
          const [first, ...rest] = Object.entries(item);
          lines.push(`  - ${first[0]}: ${yamlString(first[1])}`);
          for (const [k, v] of rest) lines.push(`    ${k}: ${yamlString(v)}`);
        }
      } else lines.push(`${key}: [${value.map(yamlString).join(', ')}]`);
    } else if (typeof value === 'boolean') lines.push(`${key}: ${value}`);
    else lines.push(`${key}: ${yamlString(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

/** Creates src/content/articles/<year>/<slug>/, refusing to overwrite an existing article. */
export async function createArticleDir(date, title) {
  const dir = join(ARTICLES_DIR, String(date.slice(0, 4)), slugify(title) || 'sem-titulo');
  try {
    await access(join(dir, 'index.md'));
    throw new Error(`Já existe um artigo em ${dir}. Escolha outro título ou apague a pasta.`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function writeArticle(dir, fields, body) {
  await writeFile(join(dir, 'index.md'), frontmatter(fields) + body.trim() + '\n');
}
