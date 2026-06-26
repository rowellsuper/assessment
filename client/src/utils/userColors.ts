export interface UserColor {
  id: string;
  bg: string;
  border: string;
  light: string;
  text: string;
  ring: string;
  hex: string;
}

export const MY_COMMENT_STYLE = {
  border: 'border-sky-400',
  borderLeft: 'border-l-sky-500',
  light: 'bg-sky-50',
  text: 'text-sky-900',
  name: 'text-sky-800',
  dot: 'bg-sky-500',
  quote: 'border-sky-300 text-sky-700',
  badge: 'bg-sky-100 text-sky-800',
  hex: '#0ea5e9',
};

export const USER_COLOR_PALETTE: UserColor[] = [
  { id: 'violet', bg: 'bg-violet-500', border: 'border-violet-400', light: 'bg-violet-50', text: 'text-violet-800', ring: 'ring-violet-200', hex: '#8b5cf6' },
  { id: 'emerald', bg: 'bg-emerald-500', border: 'border-emerald-400', light: 'bg-emerald-50', text: 'text-emerald-800', ring: 'ring-emerald-200', hex: '#10b981' },
  { id: 'amber', bg: 'bg-amber-500', border: 'border-amber-400', light: 'bg-amber-50', text: 'text-amber-900', ring: 'ring-amber-200', hex: '#f59e0b' },
  { id: 'rose', bg: 'bg-rose-500', border: 'border-rose-400', light: 'bg-rose-50', text: 'text-rose-800', ring: 'ring-rose-200', hex: '#f43f5e' },
  { id: 'cyan', bg: 'bg-cyan-500', border: 'border-cyan-400', light: 'bg-cyan-50', text: 'text-cyan-800', ring: 'ring-cyan-200', hex: '#06b6d4' },
  { id: 'indigo', bg: 'bg-indigo-500', border: 'border-indigo-400', light: 'bg-indigo-50', text: 'text-indigo-800', ring: 'ring-indigo-200', hex: '#6366f1' },
];

export function getUserColor(userId: string): UserColor {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLOR_PALETTE[Math.abs(hash) % USER_COLOR_PALETTE.length];
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
