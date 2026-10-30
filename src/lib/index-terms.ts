import { slugify, type Article } from './articles';

export interface IndexTerm {
  name: string;
  slug: string;
  articles: Article[];
}

/** The terms an article is filed under in the Índice: its section and its tags (topics and places). */
export function termsOf(article: Article): string[] {
  const { section, tags } = article.data;
  return [...new Set([section, ...tags].filter((t): t is string => Boolean(t)))];
}

/** Every term in the Índice, A to Z, with the articles filed under it. */
export function indexTerms(articles: Article[]): IndexTerm[] {
  const bySlug = new Map<string, IndexTerm>();
  for (const article of articles) {
    for (const name of termsOf(article)) {
      const slug = slugify(name);
      const term = bySlug.get(slug) ?? { name, slug, articles: [] };
      term.articles.push(article);
      bySlug.set(slug, term);
    }
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}

/** The letter a term is filed under: accents removed, so Óbidos goes under O. */
export const letterOf = (name: string) => slugify(name).charAt(0).toUpperCase();
