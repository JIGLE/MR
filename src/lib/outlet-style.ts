import type { Outlet } from './articles';

// Each publication gets a short tag (like a channel number) and a cover colour on the Publicações page.
const styles: Record<string, { code: string; color: string }> = {
  'noticias-tv': { code: 'NTV', color: '#b8281d' },
  'diario-de-noticias': { code: 'DN', color: '#1a2f6b' },
  evasoes: { code: 'EVA', color: '#1e5b45' },
  'volta-ao-mundo': { code: 'VAM', color: '#a8620a' },
  outros: { code: 'OUT', color: '#4a4744' },
};

/** Known outlets have a fixed tag; any other gets the initials of its name. */
export function outletCode(outlet: Outlet): string {
  return (
    styles[outlet.id]?.code ??
    outlet.data.name
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3)
  );
}

export function outletColor(outlet: Outlet): string {
  return styles[outlet.id]?.color ?? '#4a4744';
}
