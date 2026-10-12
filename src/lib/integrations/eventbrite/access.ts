import type { Person } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';

/** Super admins and the Events department can view Eventbrite. */
export const canViewEventbrite = (user: Person | null) => Boolean(user) && (isSuperAdmin(user) || user!.departments.includes('events'));
