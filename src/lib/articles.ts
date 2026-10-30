import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { isPublic } from './config';

export type Article = CollectionEntry<'articles'>;
export type Outlet = CollectionEntry<'outlets'>;

export { isPublic };

/** All articles visible in this build, newest first. */
export async function getArticles(): Promise<Article[]> {
  const all = await getCollection('articles', ({ data }) => (isPublic ? data.public && !data.sample : true));
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getOutlets(): Promise<Outlet[]> {
  return getCollection('outlets');
}

export async function outletOf(article: Article): Promise<Outlet> {
  const outlet = await getEntry(article.data.outlet);
  if (!outlet) throw new Error(`Unknown outlet "${article.data.outlet.id}" in ${article.id}`);
  return outlet;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function yearOf(article: Article): number {
  return article.data.date.getUTCFullYear();
}

const dateFormat = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (date: Date) => dateFormat.format(date);

/** Groups items by a key, keeping insertion order. */
export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

// Every non-Markdown file stored next to an article, resolved to a URL Vite will copy into the build.
const attachmentUrls = import.meta.glob<string>(
  '/src/content/articles/**/*.{pdf,PDF,html,htm,mhtml,warc,jpg,jpeg,JPG,png,PNG,webp,gif,tif,tiff,mp4,webm,mov,mp3,m4a,ogg,wav,zip,txt}',
  { query: '?url', import: 'default', eager: true },
);

export interface ResolvedAttachment {
  url: string;
  label: string;
  kind: NonNullable<Article['data']['attachments'][number]['kind']>;
  file: string;
}

const kindByExtension: Record<string, ResolvedAttachment['kind']> = {
  pdf: 'pdf',
  html: 'snapshot', htm: 'snapshot', mhtml: 'snapshot', warc: 'snapshot',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image', tif: 'scan', tiff: 'scan',
  mp4: 'video', webm: 'video', mov: 'video',
  mp3: 'audio', m4a: 'audio', ogg: 'audio', wav: 'audio',
};

export function resolveAttachments(article: Article): ResolvedAttachment[] {
  return article.data.attachments.map(({ file, label, kind }) => {
    const path = `/src/content/articles/${article.id}/${file.replace(/^\.\//, '')}`;
    const url = attachmentUrls[path];
    if (!url) throw new Error(`Attachment not found for "${article.id}": ${file}`);
    const ext = file.split('.').pop()!.toLowerCase();
    return { url, label, file, kind: kind ?? kindByExtension[ext] ?? 'other' };
  });
}
