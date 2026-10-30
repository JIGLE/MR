# Marlene Rendeiro: arquivo de artigos

A self-hosted archive of Marlene Rendeiro's journalism for Notícias TV, Diário de Notícias,
Evasões, Volta ao Mundo and other Portuguese publications. It keeps the text **and** everything
around it: photos with captions, embedded video, PDFs and scans of print pages, and a full copy of
each page as it was originally published, so nothing depends on the outlets' websites staying online.

It is a static site ([Astro](https://astro.build)) with Portuguese full-text search
([Pagefind](https://pagefind.app)), served by Caddy in a Docker container behind a password.
It starts as a private archive and can later be switched to a public portfolio.

## What's where

```
src/content/outlets.yaml          the publications (add new ones here)
src/content/articles/<year>/<slug>/
    index.md                      the article: metadata (frontmatter) + text in Markdown
    capa.jpg, img-01.jpg, …       images, kept at full original quality
    snapshot.html, *.pdf, *.mp4   original page, print scans, video… (listed under `attachments`)
scripts/import-url.mjs            import an article from a URL / Arquivo.pt / Wayback
scripts/new-article.mjs           create an empty article to fill in by hand
deploy/                           Caddy config for the container
docs/importing.md                 how to add articles (start here)
```

The two articles under `src/content/articles/` marked `sample: true` are demonstrations, not
real articles. Delete those folders once real articles are in.

## Working on it locally

Needs Node 22+.

```sh
npm install
npm run dev        # http://localhost:4321, live reload while editing articles
npm run build      # builds dist/ and the search index (search only works after a build)
npm run preview    # serve the built site
npm run check      # validate types and every article's metadata
```

The build fails if an article has a missing image, an unknown publication or a malformed date,
so mistakes are caught before they reach the server.

## Adding articles

See **[docs/importing.md](docs/importing.md)**. In short:

```sh
npm run import -- "https://arquivo.pt/wayback/20180601000000/https://www.evasoes.pt/…" --outlet evasoes
npm run new -- --title "Título" --outlet noticias-tv --date 2015-11-20 --print
```

## Deploying on your server

```sh
cp .env.example .env     # set ARCHIVE_USER and ARCHIVE_PASSWORD
docker compose up -d --build
```

The site is on port 8080 (change with `PORT`) and asks for the username and password from `.env`.
Put it behind your existing reverse proxy for HTTPS, or replace `:8080` in `deploy/Caddyfile` with
your domain to let Caddy get a certificate itself.

After adding articles, `git pull && docker compose up -d --build` rebuilds the site.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ARCHIVE_USER`, `ARCHIVE_PASSWORD` | — | Login for the site. The password is hashed when the container starts. |
| `ARCHIVE_AUTH` | `basic` | `off` removes the password (public site, or another proxy handles login). |
| `ARCHIVE_PUBLIC` | `false` | Build-time. See below. |
| `SITE_URL` | `http://localhost:8080` | The address the site will be reached at. |
| `PORT` | `8080` | Port on the host. |

### TrueNAS SCALE

TrueNAS can't build the image itself, so GitHub builds it: the workflow in
`.github/workflows/image.yml` publishes `ghcr.io/jigle/mr:latest` on every push to `main`.

1. Because the repository is private, the image is too. Create a GitHub
   [personal access token (classic)](https://github.com/settings/tokens) with only `read:packages`.
2. In TrueNAS: **Apps → Configuration → Manage Container Image Registries → Add**, registry
   `ghcr.io`, your GitHub username, and the token as password.
3. **Apps → Discover Apps → ⋮ → Install via YAML**, paste `deploy/truenas.yaml`, set the password, save.

To publish new articles, push to `main`, wait for the GitHub action to finish, then stop and start
the app in TrueNAS (it pulls the latest image on start). On TrueNAS 24.04 (Dragonfish) use
**Custom App** instead, with image `ghcr.io/jigle/mr`, tag `latest`, container port 8080, and the three
`ARCHIVE_*` environment variables.

### Private now, portfolio later

While `ARCHIVE_PUBLIC=false` every page is marked `noindex` and `robots.txt` blocks crawlers,
private `notes` are shown, and all articles are included.

Setting `ARCHIVE_PUBLIC=true` (and usually `ARCHIVE_AUTH=off`) turns it into a public portfolio:
only articles with `public: true` in their frontmatter are published, sample articles and private
notes are left out, and search engines are allowed. Copyright in the articles usually belongs to the
publications, so mark an article public only once it is cleared to be republished, or publish a
summary with a link to the original instead of the full text.

## Backups

Everything (text, images, originals) lives in this Git repository, so every clone is a full
backup. Large media (video, high-resolution scans) can make the repository heavy; if it grows past a
few GB, consider [Git LFS](https://git-lfs.com) for `*.mp4`, `*.pdf` and `*.tif`.
