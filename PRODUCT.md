# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro 5 static site, Pagefind search, Docker + Caddy reverse proxy. Deployed on TrueNAS SCALE via container image (ghcr.io/jigle/mr:latest, built by GitHub Actions on main push).

## Users

**Jose** (husband, primary operator): imports articles, curates the archive, manages the server. **Marlene Rendeiro** (journalist, subject): browses the archive to revisit her own work. **Future public audience** (if the site switches to portfolio mode): readers, editors, or anyone interested in her journalism.

## Product Purpose

A self-hosted, searchable archive of every article Marlene Rendeiro has published across Portuguese media — Notícias TV, Diário de Notícias, Evasões, Volta ao Mundo, and others. The archive preserves the full text, photographs, and original sources (URLs, Arquivo.pt snapshots, scans) so nothing is lost to link rot or outlet shutdowns. It is a personal preservation project first and a potential public portfolio second.

## Positioning

A complete digital archive of one journalist's body of work, organized by year, outlet, and topic, with the original visual material preserved alongside the text — not a clippings list or a link aggregator.

## Operating Context

Jose imports articles via `npm run import` (accepts a URL, Arquivo.pt link, Wayback Machine link, or a saved HTML file) or `npm run new` for manual entry. Each article lives in `src/content/articles/<year>/<slug>/` with its images and originals alongside the Markdown. The site builds statically and is served behind Caddy basic auth. The `ARCHIVE_PUBLIC=true` environment variable switches to a public portfolio that shows only articles marked `public: true`.

## Capabilities and Constraints

- Content is in Portuguese; the UI is Portuguese.
- Articles have structured metadata: title, outlet, date, section, tags, coauthors, medium (web/print/both), print edition, cover image, attachments (PDFs, scans, snapshots, video, audio).
- The cloud build environment cannot reach arquivo.pt or web.archive.org; imports from those sources run on Jose's local machine via Remote Control.
- Marlene has no PDFs or physical clippings; all sources are web-based. She may have signed some articles with initials rather than her full name.

## Brand Commitments

The name on the archive is **Marlene Rendeiro** — her professional byline. No logo exists; the nameplate in Libre Caslon Display serves as the identity.

## Evidence on Hand

Two sample articles imported (in `src/content/articles/2015/` and `src/content/articles/2018/`). An inventory of confirmed articles at `/mnt/project-files/research/inventory.csv`. No testimonials, press, or case studies — this is a personal project.

## Product Principles

1. **Preserve everything.** Text alone is not enough; images, layout clues, and original source links travel with each article.
2. **Private by default, public by choice.** The archive starts behind authentication; individual articles graduate to public only when curated.
3. **Organized for rediscovery.** Multiple entry points — by year, by outlet, by topic, by search — so any article can be found again.
4. **Low maintenance.** Static build, standard container, no external services. Jose should be able to leave it running and come back months later.
5. **Her work speaks.** The design serves the journalism, not the other way around.

## Accessibility & Inclusion

No specific accessibility standard was established. The site follows standard web accessibility practices (semantic HTML, keyboard navigation, sufficient contrast, responsive layout). The reading audience is primarily Portuguese-speaking.
