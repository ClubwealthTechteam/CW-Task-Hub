import type { Person } from '@/config/people';
import { AUTOMATIONS } from '@/data/automations';
import { canViewAutomation, isSuperAdmin } from '@/lib/access';

/** Who may look up Keap contacts in the hub: super admins, and people who own a task that uses Keap. */
export const canLookUpKeap = (user: Person | null) =>
  Boolean(user) && (isSuperAdmin(user) || AUTOMATIONS.some((a) => a.integrations.includes('keap') && canViewAutomation(user, a)));
