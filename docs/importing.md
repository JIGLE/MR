# Adding articles to the archive

Every article is one folder: `src/content/articles/<year>/<slug>/`. Inside it, `index.md` holds the
metadata and the text, and every original file (photos, video, PDFs, scans, a copy of the web page)
sits next to it. Because the files are stored here, the archive keeps working even after a
publication's website changes or disappears.

There are three ways an article arrives. Pick the one that matches what you have.

## 1. The article is (or was) online → `npm run import`

```sh
npm run import -- <url> --outlet <id> [--date AAAA-MM-DD] [--tags "Viagens, Portugal"] [--title "…"]
```

`<id>` is one of the keys in `src/content/outlets.yaml` (`noticias-tv`, `diario-de-noticias`,
`evasoes`, `volta-ao-mundo`, `outros`). Add a publication there first if it is missing.

The URL can be:

- **The live page**, if it is still online.
- **An Arquivo.pt capture** (best source for Portuguese media). Search at
  <https://arquivo.pt> by the original address, open a capture, and copy its address, e.g.
  `https://arquivo.pt/wayback/20180601000000/https://www.evasoes.pt/…`.
- **A Wayback Machine capture**, e.g. `https://web.archive.org/web/20180601000000/https://…`.

For archive captures the script asks for the page exactly as it was captured (without the archive's
toolbar), downloads images from the same capture, and fills in both `originalUrl` and `archiveUrl`.

What it saves:

| File | What it is |
| --- | --- |
| `index.md` | Title, subtitle, date, section, links, and the text converted to Markdown |
| `img-01.jpg`, `img-02.jpg`, … | Every image in the article body, at the largest size offered |
| `capa.jpg` | The page's share image, used as the cover |
| `snapshot.html` | The whole original page, scripts removed, images embedded inside it |

If a page blocks the script (paywall, cookie wall, bot protection), open it in your browser, use
*Save page as… → Web page, HTML only*, and import the saved file:

```sh
npm run import -- --file pagina.html --url <original url> --outlet dn --date 2016-03-04
```

### Always review an import

Automatic extraction gets the main text right most of the time but not always. Open
`npm run dev`, go to the article, and compare it with the original (link in "Fonte e originais"):

- **Captions and photo credits.** Figures become an image followed by an italic caption. Check
  that credits weren't lost.
- **Boxes, fact sheets, galleries.** Sidebars ("Onde comer", "Como ir") are often outside the main
  text. Copy them in by hand; a `---` line and a `## Heading` work well.
- **Images marked `<!-- REVER -->`** couldn't be downloaded and still point at the web. Find them in
  the snapshot or another capture, save them in the folder, and point the Markdown at `./file.jpg`.
- **Subtitle and tags.** The subtitle comes from the page's description, which is sometimes generic.
  Tags are yours to choose; keep them consistent (`Viagens`, not `viagem` and `Viagem`).
- **Remove leftovers** such as "Leia também", newsletter boxes or share buttons.

## 2. The article only exists in print → `npm run new`

```sh
npm run new -- --title "Título do artigo" --outlet noticias-tv --date 2015-11-20 --print
```

This creates the folder with an `index.md` to fill in. Then:

1. Scan or photograph the pages at 300 dpi or more and save them in the folder
   (`pagina-1.jpg`, `pagina-2.jpg`, or one `edicao.pdf`).
2. List them under `attachments` with `kind: scan` (images) or as a PDF; scans are shown on the
   article page and are downloadable at full resolution.
3. Transcribe the text into `index.md` so it can be searched. OCR saves a lot of typing:
   `tesseract pagina-1.jpg - -l por` (install `tesseract-ocr` and `tesseract-ocr-por`).
4. Fill in `printEdition`, e.g. `"n.º 1234, pp. 42–45"`.

## 3. You have a PDF or file from the publication

Treat it like print: `npm run new`, put the file in the folder, list it under `attachments`, and
paste the text into `index.md`.

## Video, audio and embeds

An embedded YouTube/Vimeo video or a social media post can stay in the Markdown as HTML (the
importer keeps `<iframe>`s). But embeds disappear when the original is deleted, so also keep a copy:

```sh
yt-dlp -o "src/content/articles/2019/slug/video.mp4" "<video url>"
```

and list it under `attachments` (`kind: video`), where it gets its own player on the page.

## Frontmatter reference

```yaml
---
title: "Título"                    # required
subtitle: "Pós-título / lead"
outlet: evasoes                    # required, a key from outlets.yaml
date: 2018-05-12                   # required, publication date
section: Viagens                   # the section of the publication
tags: [Viagens, Portugal]          # topics, used for the "Temas" pages
coauthors: [Nome Apelido]          # if the piece was co-signed
originalUrl: https://…             # where it was published
archiveUrl: https://arquivo.pt/…   # a capture that still works
medium: web                        # web | print | both
printEdition: "n.º 1234, p. 42"
cover: ./capa.jpg                  # image shown at the top and in lists
coverAlt: "Descrição da imagem"
coverCaption: "Legenda. Foto: Nome"
attachments:                       # original files kept with the article
  - file: ./snapshot.html
    label: Cópia da página como foi publicada
  - file: ./pagina-1.jpg
    label: Página da revista
    kind: scan                     # pdf | snapshot | scan | image | video | audio | other
public: false                      # true = include when the site is built as a public portfolio
notes: "Private notes, never shown publicly"
---
```

Images inside the text are written `![description](./file.jpg)`, always relative to the article's
folder. The site generates lighter versions for browsing, but the original files are never altered.

## Saving the work

```sh
npm run build                     # make sure everything is valid
git add src/content && git commit -m "Add: <title>" && git push
```

Then on the server: `git pull && docker compose up -d --build`.

## Finding everything she wrote

A few places worth searching, roughly in order of yield:

- **Arquivo.pt** full-text search for "Marlene Rendeiro" (it indexes Portuguese news sites going
  back to the 1990s), plus the URL search for author pages like `evasoes.pt/autor/…`.
- The outlets' own author pages and site search, while they exist.
- The **Wayback Machine** for the same author pages.
- Marlene's own clippings, PDFs sent by editors, and the publications' archive departments for
  print-only pieces.
