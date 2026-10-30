import { defineCollection, reference, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

// Each publication (Notícias TV, DN, Evasões…) is listed once in outlets.yaml.
const outlets = defineCollection({
  loader: file('src/content/outlets.yaml'),
  schema: z.object({
    name: z.string(),
    url: z.string().url().optional(),
    description: z.string().optional(),
  }),
});

// One folder per article: src/content/articles/<year>/<slug>/index.md
// plus every original file (images, PDFs, page snapshots, video) next to it.
const articles = defineCollection({
  loader: glob({
    pattern: '**/index.md',
    base: './src/content/articles',
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      outlet: reference('outlets'),
      date: z.coerce.date(),
      section: z.string().optional(),
      tags: z.array(z.string()).default([]),
      coauthors: z.array(z.string()).default([]),
      // Where it was originally published, and where a copy can still be found.
      originalUrl: z.string().url().optional(),
      archiveUrl: z.string().url().optional(),
      medium: z.enum(['web', 'print', 'both']).default('web'),
      printEdition: z.string().optional(), // e.g. "n.º 1234, p. 42"
      cover: image().optional(),
      coverAlt: z.string().optional(),
      coverCaption: z.string().optional(),
      // Original files kept alongside the text: scans, PDFs, HTML snapshots, video, audio.
      attachments: z
        .array(
          z.object({
            file: z.string(),
            label: z.string(),
            kind: z.enum(['pdf', 'snapshot', 'scan', 'image', 'video', 'audio', 'other']).optional(),
          }),
        )
        .default([]),
      // Only articles marked public appear once the site is built with ARCHIVE_PUBLIC=true.
      public: z.boolean().default(false),
      sample: z.boolean().default(false),
      notes: z.string().optional(), // private notes, never shown in a public build
    }),
});

export const collections = { outlets, articles };
