// Who uses the hub, which department they belong to, and who can see everything.
// `auditKey` links a person to their 10 requests in src/data/audit.json (from the CW AI AUDIT sheet).

import type { DepartmentId } from './departments';

export type Role = 'member' | 'super_admin';

export interface Person {
  id: string;
  name: string;
  role: Role;
  departments: DepartmentId[];
  auditKey?: string;
  title?: string;
}

export const PEOPLE: Person[] = [
  // Super admins: see every department, manage integrations.
  { id: 'miguel', name: 'Miguel Ababon', role: 'super_admin', departments: ['tech'], title: 'AI Tech' },
  { id: 'omerson', name: 'Omerson Cruz', role: 'super_admin', departments: ['tech'], auditKey: 'omerson', title: 'Tech' },
  { id: 'camille', name: 'Camille', role: 'super_admin', departments: ['admin'], auditKey: 'camille' },

  // #1 Events
  { id: 'ali', name: 'Ali-Ace Berico', role: 'member', departments: ['events'], auditKey: 'ali' },
  { id: 'andrea', name: 'Andrea Uy', role: 'member', departments: ['events'], auditKey: 'andrea' },
  { id: 'liz', name: 'Liz Capili', role: 'member', departments: ['events'], auditKey: 'liz' },

  // #2 Client Care
  { id: 'jowee', name: 'Jowee (Jowelyn)', role: 'member', departments: ['client-care'], auditKey: 'jowee' },
  { id: 'jizel', name: 'Jizel', role: 'member', departments: ['client-care'], auditKey: 'jizel' },
  { id: 'joshua', name: 'Joshua', role: 'member', departments: ['client-care'] },

  // #3 Social Media
  { id: 'jaymar', name: 'Jay Mar', role: 'member', departments: ['social-media'], auditKey: 'jaymar' },

  // #4 Admin
  { id: 'kathleen', name: 'Kathleen', role: 'member', departments: ['admin'], auditKey: 'kathleen' },
  { id: 'amrissa', name: 'Amrissa', role: 'member', departments: ['admin'], auditKey: 'amrissa' },
];

export const personById = (id: string | undefined | null) => PEOPLE.find((p) => p.id === id);
export const peopleIn = (dept: DepartmentId) => PEOPLE.filter((p) => p.departments.includes(dept));
