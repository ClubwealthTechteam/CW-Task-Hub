// New Client Welcome Posts is a Social Media tool: that department and super admins.

import type { Person } from '@/config/people';
import { canViewDepartment } from '@/lib/access';

export const WELCOME_DEPT = 'social-media';
export const canUseWelcome = (user: Person | null | undefined) => Boolean(user) && canViewDepartment(user, WELCOME_DEPT);
