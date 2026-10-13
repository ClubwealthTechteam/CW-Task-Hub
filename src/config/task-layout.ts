// How tasks are arranged in the workspace sidebar, and tasks that moved out of the hub.

/** Tasks shown together under one dropdown in the sidebar, in this order. */
export const TASK_GROUPS: { id: string; title: string; taskIds: string[] }[] = [
  { id: 'content-creation', title: 'Content Creation tabs', taskIds: ['jaymar-4', 'jaymar-5', 'jaymar-6'] },
];

/** Tasks handled elsewhere, so the hub doesn't show them. */
export const HANDLED_ELSEWHERE: Record<string, string> = {
  'jaymar-2': 'Birthday posts are handled by CW Assistant in Slack',
};
