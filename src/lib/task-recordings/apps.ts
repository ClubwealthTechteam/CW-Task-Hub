// The Flow Canvas app ids (the CW AI Hub canvas's APPS list) and how a page's address maps to one.

export const CANVAS_APPS = {
  node: 'New node', keap: 'Keap', gmail: 'Gmail', sheets: 'Google Sheets', calendar: 'Calendar', slack: 'Slack',
  claude: 'Claude AI', plusthis: 'PlusThis', twilio: 'Twilio SMS', prospect: 'ProspectBoss', cwu: 'CW University',
  eventbrite: 'Eventbrite', zapier: 'Zapier', make: 'Make.com', appsscript: 'Apps Script', salesmsg: 'Salesmsg',
  acrobat: 'Adobe Acrobat', drive: 'Google Drive', docs: 'Google Docs', zoom: 'Zoom', jotform: 'Jotform', canva: 'Canva',
  figma: 'Figma', facebook: 'Facebook', instagram: 'Instagram', timedoctor: 'Time Doctor', cwreports: 'CW Reports',
  homexa: 'Homexa', webhook: 'Webhook', human: 'Human review',
} as const;
export type CanvasApp = keyof typeof CANVAS_APPS;
export const APP_IDS = Object.keys(CANVAS_APPS) as CanvasApp[];

const RULES: [RegExp, CanvasApp][] = [
  [/docs\.google\.com\/spreadsheets/, 'sheets'],
  [/docs\.google\.com\/(document|presentation)/, 'docs'],
  [/script\.google\.com/, 'appsscript'],
  [/drive\.google\.com/, 'drive'],
  [/mail\.google\.com/, 'gmail'],
  [/calendar\.google\.com/, 'calendar'],
  [/slack\.com/, 'slack'],
  [/infusionsoft\.com|keap\.(com|app)/, 'keap'],
  [/eventbrite\./, 'eventbrite'],
  [/claude\.ai/, 'claude'],
  [/zapier\.com/, 'zapier'],
  [/make\.com/, 'make'],
  [/learning\.clubwealth\.com\/reports/, 'cwreports'],
  [/clubwealthu?\.com|learning\.clubwealth\.com/, 'cwu'],
  [/prospectboss/, 'prospect'],
  [/acrobat\.adobe\.com|adobe\.com/, 'acrobat'],
  [/zoom\.us/, 'zoom'],
  [/jotform\.com/, 'jotform'],
  [/canva\.com/, 'canva'],
  [/figma\.com/, 'figma'],
  [/facebook\.com/, 'facebook'],
  [/instagram\.com/, 'instagram'],
  [/timedoctor\.com/, 'timedoctor'],
  [/homexa/, 'homexa'],
  [/twilio\.com/, 'twilio'],
  [/plusthis\.com/, 'plusthis'],
  [/salesmessage|salesmsg/, 'salesmsg'],
];

export const appForUrl = (url: string): CanvasApp => RULES.find(([re]) => re.test(url))?.[1] ?? 'node';
