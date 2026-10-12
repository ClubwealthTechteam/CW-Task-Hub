// Line icons used in the workspace sidebar and panels (same set as the CWU mockups).

import type { TaskIcon } from '@/lib/workspace';

const PATHS: Record<TaskIcon | 'send' | 'plus' | 'info', string[]> = {
  chat: ['M4 5h16v11H8l-4 4z'],
  card: ['M3 6h18v12H3z', 'M3 10h18'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v5', 'M16 3v5'],
  megaphone: ['M3 11v3l12 5V6L3 11z', 'M15 8a4 4 0 0 1 0 8'],
  person: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c1-4 4-6 8-6s7 2 8 6'],
  flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
  book: ['M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z', 'M5 17a3 3 0 0 1 3-3h11'],
  table: ['M3 5h18v14H3z', 'M3 10h18', 'M9 10v9'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  spark: ['M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'],
  home: ['M4 11l8-7 8 7', 'M6 10v10h12V10'],
  mail: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  send: ['M4 12l16-8-6 16-3-7z'],
  plus: ['M12 5v14', 'M5 12h14'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export function Sparkle({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 4.6L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.9z" />
      <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}
