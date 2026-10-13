// Ready-made welcome captions and the photo request message for New Client Welcome Posts (Jay's task #1).
// Names are used instead of pronouns. Missing details are simply left out of the sentence.

export interface ClientFacts { first: string; full: string; business?: string; city?: string; coach?: string }

const of = (f: ClientFacts) => (f.business ? ` of ${f.business}` : '');
const from = (f: ClientFacts) => (f.city ? ` from ${f.city}` : '');
const coach = (f: ClientFacts, s: string) => (f.coach ? s.replace('{coach}', f.coach) : '');

export const PAGE_CAPTIONS: ((f: ClientFacts) => string)[] = [
  (f) => `Please join us in welcoming ${f.full}${of(f)}${from(f)} to the Club Wealth family! 🎉${coach(f, ` ${f.first} is starting the journey with coach {coach}, and we can’t wait to see what comes next.`)} Welcome aboard, ${f.first}!`,
  (f) => `New member alert! 🚀 We’re excited to welcome ${f.full}${f.business ? `, owner of ${f.business},` : ''}${f.city ? ` in ${f.city}` : ''} to Club Wealth. Here’s to big goals, smart moves and a great year ahead. Welcome, ${f.first}!`,
  (f) => `Welcome to Club Wealth, ${f.full}! 👋 ${f.first}${from(f)}${f.business ? ` (${f.business})` : ''} just joined our community of business owners and investors.${coach(f, ` Coach {coach} is ready to help ${f.first} hit the ground running.`)}`,
];

export const GROUP_CAPTIONS: ((f: ClientFacts) => string)[] = [
  (f) => `Everyone, please give a warm welcome to ${f.full}${from(f)}! 🙌 ${f.first}${f.business ? ` runs ${f.business} and` : ''} just joined Club Wealth${coach(f, ', working with coach {coach}')}. Drop a 👋 in the comments and say hi!`,
  (f) => `Say hello to our newest member, ${f.full}! 🎉${f.business || f.city ? ` ${f.first} is ${[f.business && `with ${f.business}`, f.city && `based in ${f.city}`].filter(Boolean).join(' and ')}.` : ''} ${f.first}, welcome to the Group: this is the place to ask questions, share wins and connect. Members, what’s one tip you’d give ${f.first} on day one?`,
  (f) => `Welcome to the Club Wealth Group, ${f.first}! 👋 We’re so glad to have ${f.full}${of(f)}${from(f)} with us.${coach(f, ` ${f.first} is working with coach {coach}.`)} Comment below to welcome ${f.first} to the community!`,
];

export const photoRequest = (f: ClientFacts) =>
  `Hi ${f.first}! Welcome to Club Wealth 🎉 We’d love to give you a shout-out on our Facebook Page and in our members’ Group. Could you send us a photo of yourself (a clear headshot works best) in the next couple of days? If you’d rather we didn’t use a photo, no problem at all, just let us know!`;
