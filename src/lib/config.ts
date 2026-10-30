// Build-time settings. The site is static, so these are read once when `npm run build` runs.

/** Private archive (default) or public portfolio. Set ARCHIVE_PUBLIC=true to publish. */
export const isPublic = process.env.ARCHIVE_PUBLIC === 'true';

export const siteTitle = 'Marlene Rendeiro';
export const siteTagline = isPublic ? 'Jornalismo' : 'Arquivo de artigos';
