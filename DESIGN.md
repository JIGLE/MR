# Design

The visual system for the archive, written while applying the guidance from
[Impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0; only its guidance was used, no files were copied).
Keep changes consistent with this file, and update it when the system changes.

## Direction

**The magazine cover.** The home page is a cover: the newest article's photograph full-bleed, her name huge in a
display serif, and the latest articles as cover lines under yellow section tags. Inside, the pages borrow from
print reference: a wall calendar for the years, an A–Z index with thumb tabs, one "magazine cover" per outlet.

- **Modes.** The home page, Publicações, Anos and Índice are for browsing and can be loud. Article pages are for
  reading: one calm serif column, expression only in the cover photo and title.
- **Refused defaults.** No cards with shadows, no eyebrow labels above headings, no big-number stat blocks, no
  coloured side stripes, no cream paper with a red accent.

## Architecture

The menu (on every page) has five sections; her name in the corner always goes to the cover. The footer repeats
the sections and links to the site map.

| Page | URL | Children |
|---|---|---|
| Início (cover) | `/` | |
| Artigos, by year | `/artigos/` | each article at `/artigos/<year>/<slug>/` |
| Publicações | `/publicacoes/` | `/publicacoes/<outlet>/` |
| Anos, a wall calendar | `/anos/` (latest year) | `/anos/<year>/` |
| Índice, topics and places A–Z | `/indice/` | `/indice/<term>/` (`/temas/` redirects here) |
| Pesquisa (Pagefind) | `/pesquisa/` | |
| Mapa do site | `/mapa/` | |

Index terms are each article's `section` plus its `tags`. Yellow section tags link to the term's page; year
headings and article dates link to the year's calendar.

## Colour

Tinted neutrals, black bars, and one committed yellow for tags and highlights. Each outlet also has its own
colour, used only on its Publicações cover and code (`src/lib/outlet-style.ts`).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | `#ecebe5` | `#121211` | page |
| `--row` | `#f7f6f1` | `#1c1c1a` | list rows, panels |
| `--ink` | `#121212` | `#ecebe5` | text, heavy rules |
| `--ink-2` | `#5b5953` | `#a8a69e` | secondary text, dates |
| `--rule` | `#c4c1b8` | `#3a3936` | hairlines |
| `--yellow` | `#ffe03a` | same | section tags, calendar days, current menu item |
| `--bar` | `#121212` | `#000000` | menu bar |

Both themes follow the reader's system setting.

## Type

Self-hosted from `public/fonts` (SIL Open Font License, texts alongside).

- **Libre Caslon Display**: her name, page titles, article titles, cover lines.
- **Libre Franklin** (variable): menu, metadata, interface text.
- **Big Shoulders Display** (variable, condensed): yellow section tags, outlet codes, calendar labels.
- **Source Serif 4** (variable, optical sizes): article body. Body 18px, measure about 65 characters
  (`--measure: 38rem`). Dates and counts use tabular numerals.

## Signature details

- On the cover the menu bar is transparent and the nameplate is hidden, because the cover carries the name.
- The cover credits its photograph ("Fotografia:") with a link to that article.
- Articles open with a drop cap; quotations hang a Portuguese guillemet («) in the margin.
- "Fonte e originais" is a colophon under a double rule, not a boxed card.
- Selection, focus rings and scrollbar are themed from the palette.
