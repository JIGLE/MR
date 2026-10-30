#!/usr/bin/env node
// Creates an empty article folder to fill in by hand (e.g. for print-only articles).
//
//   npm run new -- --title "Título do artigo" --outlet noticias-tv --date 2015-11-20 [--print]
import { createArticleDir, parseArgs, writeArticle } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.title || !args.outlet || !args.date) {
  console.error('Uso: npm run new -- --title "Título" --outlet <id da publicação> --date AAAA-MM-DD [--print]');
  console.error('As publicações estão em src/content/outlets.yaml');
  process.exit(1);
}

const dir = await createArticleDir(args.date, args.title);
await writeArticle(
  dir,
  {
    title: args.title,
    outlet: args.outlet,
    date: args.date,
    section: '',
    tags: [],
    medium: args.print ? 'print' : 'web',
    printEdition: args.print ? 'n.º ?, p. ?' : undefined,
    attachments: [],
  },
  `Escreva ou cole aqui o texto do artigo.

Guarde as imagens nesta pasta e use-as assim: ![descrição](./foto.jpg)
`,
);
console.log(`Criado: ${dir}/index.md`);
