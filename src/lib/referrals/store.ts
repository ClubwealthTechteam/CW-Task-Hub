// Referral Prospecting (Jay Mar's task #8): referral opportunities found in Facebook Group posts, the Club
// Wealth member each one suits, and the SMS to send that member. Stored in the hub; Keap is only read.

import crypto from 'node:crypto';
import { getJSON, setJSON } from '@/lib/store';

export const OPP_STATUSES = ['new', 'texted', 'won', 'closed'] as const;
export type OppStatus = typeof OPP_STATUSES[number];

export interface Opportunity {
  id: string;
  batchId: string;
  poster?: string;
  need: string;          // what they're asking for, in a few words
  service?: string;      // the kind of business that fits, e.g. "realtor"
  city?: string;
  state?: string;
  excerpt?: string;      // the key part of the post
  group?: string;        // which Facebook Group
  postLink?: string;
  memberId?: number;     // the Club Wealth member it suits (Keap contact id)
  otherMemberIds?: number[];
  why?: string;
  sms?: string;
  status: OppStatus;
  at: number;
  by: string;
  updated?: number;
}

/** One paste of posts, read by the assistant in a background chat. */
export interface Batch {
  id: string;
  conversationId: string;
  messageId: string;
  status: 'reading' | 'done' | 'error';
  posts: number;
  group?: string;
  preview: string;
  found?: number;
  error?: string;
  at: number;
  by: string;
}

export interface MemberNote { services?: string; paused?: boolean }

export interface ReferralSettings {
  /** 'claude': Claude works out which Keap tag marks current members. 'tag': the tags chosen here. */
  find: 'claude' | 'tag';
  tagIds: number[];            // Keap tags that mark a Club Wealth member
  tagNames: string[];
  industryField?: number;      // a Keap custom field with the member's industry, if there is one
  industryLabel?: string;
  sender: string;              // how the SMS is signed
}

const OPPS = 'referral:opps';
const BATCHES = 'referral:batches';
const NOTES = 'referral:member-notes';
const SETTINGS = 'referral:settings';
const MAX_OPPS = 1500;

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = { find: 'claude', tagIds: [], tagNames: [], sender: 'Jay from Club Wealth' };

export const listOpps = () => getJSON<Opportunity[]>(OPPS, []);
export const saveOpps = (list: Opportunity[]) => setJSON(OPPS, list.slice(0, MAX_OPPS));
export const listBatches = () => getJSON<Batch[]>(BATCHES, []);
export const saveBatches = (list: Batch[]) => setJSON(BATCHES, list.slice(0, 100));
export const memberNotes = () => getJSON<Record<string, MemberNote>>(NOTES, {});
export const saveMemberNotes = (n: Record<string, MemberNote>) => setJSON(NOTES, n);
export const getReferralSettings = async () => ({ ...DEFAULT_REFERRAL_SETTINGS, ...(await getJSON<Partial<ReferralSettings>>(SETTINGS, {})) });
export const saveReferralSettings = (s: ReferralSettings) => setJSON(SETTINGS, s);
export const newId = (p: string) => `${p}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
