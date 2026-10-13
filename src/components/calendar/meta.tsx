// Labels, colors and icons for the content calendar's post types, platforms and statuses.

import type { Platform, PostStatus, PostType } from '@/lib/calendar-types';

export const TYPE_META: Record<PostType, { label: string; color: string; icon: string }> = {
  event: { label: 'Event', color: '#2563eb', icon: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h3v3H8z' },
  testimonial: { label: 'Testimonial', color: '#059669', icon: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z' },
  promotion: { label: 'Promotion', color: '#d97706', icon: 'M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11' },
  welcome: { label: 'Client welcome', color: '#7c3aed', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8v6M16 11h6' },
  recurring: { label: 'Recurring', color: '#0891b2', icon: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4' },
  other: { label: 'Other', color: '#64748b', icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' },
};

export const PLATFORM_META: Record<Platform, { label: string; short: string; color: string }> = {
  'fb-page': { label: 'Facebook Page', short: 'FB', color: '#1877f2' },
  'fb-group': { label: 'Facebook Group', short: 'Grp', color: '#3b5998' },
  instagram: { label: 'Instagram', short: 'IG', color: '#c13584' },
  linkedin: { label: 'LinkedIn', short: 'in', color: '#0a66c2' },
  youtube: { label: 'YouTube', short: 'YT', color: '#e00000' },
  tiktok: { label: 'TikTok', short: 'TT', color: '#111827' },
};

export const STATUS_META: Record<PostStatus, { label: string; cls: string }> = {
  idea: { label: 'Idea', cls: 'st-idea' },
  drafting: { label: 'Drafting', cls: 'st-drafting' },
  review: { label: 'In review', cls: 'st-review' },
  scheduled: { label: 'Scheduled', cls: 'st-scheduled' },
  posted: { label: 'Posted', cls: 'st-posted' },
};

export function TypeIcon({ type, size = 14 }: { type: PostType; size?: number }) {
  const m = TYPE_META[type];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={m.icon} />
    </svg>
  );
}

export function PlatformBadges({ platforms }: { platforms: Platform[] }) {
  if (!platforms.length) return null;
  return (
    <span className="cc-plats">
      {platforms.map((p) => <span key={p} className="cc-plat" style={{ background: PLATFORM_META[p].color }} title={PLATFORM_META[p].label}>{PLATFORM_META[p].short}</span>)}
    </span>
  );
}
