# Design

The visual system for the archive, written while applying the guidance from
[Impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0; only its guidance was used, no files were copied).
Keep changes consistent with this file, and update it when the system changes.

## Direction

**The clippings register.** The site is set like a newspaper library's index of cuttings, not a blog of cards:
one ruled line per article, the date in the margin, the year as a large running numeral. The editor's blue
pencil owns the frame; the reading column stays calm.

- **Modes.** The home page and lists are a register to scan; article pages are for reading. Expression lives in
  the masthead and headings, never in the reading column.
- **Refused defaults.** No cream paper with serif display and a red accent, no cards or pills, no eyebrow labels
  above headings, no big-number stat blocks, no coloured side stripes.

## Colour

Restrained: tinted neutrals plus one committed blue that owns the masthead (and the whole first viewport on the
home page).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | `#f2f3ef` cool newsprint | `#111319` | page |
| `--ink` | `#15171d` | `#e5e6ea` | text, heavy rules |
| `--ink-2` | `#4f5463` | `#a2a7b5` | secondary text, dates |
| `--rule` | `#cdd0d6` | `#2c303b` | hairlines |
| `--blue` | `#1f3bb3` | `#1b2c86` | masthead band, links (light) |
| `--blue-soft` | `#c9d1f2` | `#9eb0ff` | selection, search highlight, links (dark) |
| `--blue-wash` | `#e3e7f6` | `#1a2140` | notices |

Both themes follow the reader's system setting.

## Type

Self-hosted from `public/fonts` (SIL Open Font License, texts alongside).

- **Archivo** (variable width and weight): masthead, headings, metadata, navigation. Expanded (125%) and heavy
  for the name and year numerals; 112% for page and article titles.
- **Source Serif 4** (variable, optical sizes): body text, standfirsts, and article titles in lists.
- Body 18px, measure about 65 characters (`--measure: 38rem`). Dates and counts use tabular numerals.

## Signature details

- Year headings are big Archivo numerals over a 2px ink rule; the list continues as hairline rows.
- Quotations hang a blue Portuguese guillemet («) in the margin.
- The first line of an article is set in small capitals.
- "Fonte e originais" is a colophon under a double rule, not a boxed card.
- Selection, focus rings, caret and scrollbar are themed from the palette.
