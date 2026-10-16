// The department workspaces. Each one is a tab in the hub; people only see the ones they belong to.

export type DepartmentId = 'events' | 'client-care' | 'social-media' | 'video-editing' | 'aim' | 'admin' | 'tech';

export interface Department {
  id: DepartmentId;
  name: string;
  /** Shown under the name on cards and the tab header. */
  blurb: string;
  /** Hidden workspaces only show to super admins (not one of the four team tabs). */
  hidden?: boolean;
}

export const DEPARTMENTS: Department[] = [
  { id: 'events', name: 'Events', blurb: 'Half-Day events, registrations, venues and event reporting' },
  { id: 'client-care', name: 'Client Care', blurb: 'Client follow-ups, billing, coaching and Client Care replies' },
  { id: 'social-media', name: 'Social Media', blurb: 'Posts, graphics, content calendar and lead sources' },
  { id: 'video-editing', name: 'Video Editing', blurb: 'Event recordings, edits and video uploads' },
  { id: 'aim', name: 'AIM Team', blurb: 'AIM: custom Keap setups for coaches' },
  { id: 'admin', name: 'Admin', blurb: 'Recruiting, payroll, big events, content review and trackers' },
  { id: 'tech', name: 'Tech', blurb: 'Infrastructure, security and internal tools', hidden: true },
];

export const departmentById = (id: string) => DEPARTMENTS.find((d) => d.id === id);
