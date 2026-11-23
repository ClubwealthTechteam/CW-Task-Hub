// Same as /api/venues/ratings/requests, at a path under /api/routines/report: the Claude routines' cloud
// environment adds ROUTINES_REPORT_SECRET only to requests for /api/routines/report*, so the venue rating
// DMs routine calls this one.
export { GET, POST, dynamic } from '@/app/api/venues/ratings/requests/route';
