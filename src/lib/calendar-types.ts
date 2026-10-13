// Content calendar types and choices, shared by the server and the browser.

export const POST_TYPES = ['event', 'testimonial', 'promotion', 'welcome', 'recurring', 'other'] as const;
export const PLATFORMS = ['fb-page', 'fb-group', 'instagram', 'linkedin', 'youtube', 'tiktok'] as const;
export const STATUSES = ['idea', 'drafting', 'review', 'scheduled', 'posted'] as const;
export const REPEATS = ['none', 'weekly', 'monthly', 'yearly'] as const;

export type PostType = typeof POST_TYPES[number];
export type Platform = typeof PLATFORMS[number];
export type PostStatus = typeof STATUSES[number];
export type Repeat = typeof REPEATS[number];

export interface CalendarPost {
  id: string;
  date: string;            // YYYY-MM-DD (first date for a repeating post)
  time?: string;           // HH:MM, 24h
  title: string;
  type: PostType;
  platforms: Platform[];
  status: PostStatus;
  assignee?: string;       // hub person id
  notes?: string;
  link?: string;           // Canva design, Google Doc or the live post
  repeat: Repeat;
  until?: string;          // YYYY-MM-DD, last date a repeating post runs
  /** Status of single dates of a repeating post, e.g. { "2026-10-19": "posted" }. */
  occurrences?: Record<string, PostStatus>;
  by: string;
  at: number;
  updated?: number;
}
