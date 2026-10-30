import type { Outlet } from './articles';

// Short tags shown in lists, like channel numbers in a TV guide.
const codes: Record<string, string> = {
  'noticias-tv': 'NTV',
  'diario-de-noticias': 'DN',
  evasoes: 'EVA',
  'volta-ao-mundo': 'VAM',
  outros: 'OUT',
};

/** Known outlets have a fixed code; any other gets the initials of its name. */
export function outletCode(outlet: Outlet): string {
  return (
    codes[outlet.id] ??
    outlet.data.name
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3)
  );
}
