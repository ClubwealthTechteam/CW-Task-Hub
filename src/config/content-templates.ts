// Ready-to-use prompts for the Social Media team's assistant (content creation). Words in [brackets] are
// for the person to fill in. `tasks` lists the tasks a template suits best; those show first on that task.

export interface ContentTemplate {
  id: string;
  group: 'Captions' | 'Graphics' | 'Threads' | 'Repurpose' | 'Events' | 'Clients' | 'Planning';
  title: string;
  hint: string;
  prompt: string;
  tasks?: string[];
}

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    id: 'caption-fb-ig',
    group: 'Captions',
    title: 'Facebook + Instagram caption',
    hint: 'One idea, two platform-ready captions',
    tasks: ['jaymar-4'],
    prompt: `Write a post for Club Wealth about: [topic or key message].
Audience: [business owners / real estate investors / our Facebook Group members].
Goal: [get comments / drive sign-ups to (link) / build trust].
Give me:
1. A Facebook Page caption (80–150 words) with a strong first line, short paragraphs, and a clear call to action.
2. An Instagram caption (under 100 words) with 5–8 relevant hashtags at the end.
Tone: confident, warm, practical. No hype words like "guaranteed" or "get rich".`,
  },
  {
    id: 'hooks',
    group: 'Captions',
    title: '10 scroll-stopping hooks',
    hint: 'First lines to test for one topic',
    tasks: ['jaymar-4', 'jaymar-5'],
    prompt: `Give me 10 different opening lines (hooks) for a post about: [topic].
Mix the styles: a bold statement, a question, a surprising number, a short story opener, a common mistake, and a "most people think… but" line.
Each hook under 15 words. Mark your top 3 and say why in one line each.`,
  },
  {
    id: 'group-engagement',
    group: 'Captions',
    title: 'Facebook Group engagement post',
    hint: 'Gets members talking in the Group',
    tasks: ['jaymar-4'],
    prompt: `Write a Facebook Group post that gets members to comment.
Theme: [e.g. biggest win this week / question about (topic) / this or that].
Keep it under 60 words, end with one easy question people can answer in a few words, and suggest a short follow-up comment I can post to keep the thread going.`,
  },
  {
    id: 'threads-series',
    group: 'Threads',
    title: 'Threads post series',
    hint: '5 short posts from one idea',
    tasks: ['jaymar-5'],
    prompt: `Turn this idea into 5 Threads posts for Club Wealth: [idea, lesson or quote].
Each post under 300 characters, conversational, one idea per post, no hashtags.
Post 1 hooks attention, posts 2–4 give practical value, post 5 asks a question or points to [link / our next Half-Day].`,
  },
  {
    id: 'threads-replies',
    group: 'Threads',
    title: 'Reply ideas for comments',
    hint: 'Friendly replies to keep the conversation going',
    tasks: ['jaymar-5', 'jaymar-4'],
    prompt: `Here are comments on our post: [paste the comments].
Write a short, friendly reply to each (under 40 words), in Club Wealth's voice. Answer questions simply; if someone needs personal advice, invite them to message us instead of answering in public.`,
  },
  {
    id: 'graphic-quote',
    group: 'Graphics',
    title: 'Quote graphic',
    hint: 'Square quote card, Club Wealth colors',
    tasks: ['jaymar-6', 'jaymar-4'],
    prompt: `Make a square (1080x1080) quote graphic.
Quote: "[quote]"
Name under the quote: [name, title] (leave it off if blank).
Style: navy background, gold accent line, big readable quote, small CLUB WEALTH wordmark.
Then write a short caption to go with it.`,
  },
  {
    id: 'graphic-photo',
    group: 'Graphics',
    title: 'Graphic from my photo',
    hint: 'Attach a photo first (📎)',
    tasks: ['jaymar-6'],
    prompt: `Use the photo I attached to make a [square 1080x1080 / portrait 1080x1350 / story 1080x1920] graphic.
Headline: [headline, max 8 words]
Supporting line: [one short line]
Put a navy overlay on the photo so the text is easy to read, and keep faces clear of text.`,
  },
  {
    id: 'graphic-review',
    group: 'Graphics',
    title: 'Review my design',
    hint: 'Attach your Canva export first (📎)',
    tasks: ['jaymar-6'],
    prompt: `Review the graphic I attached before I post it.
Check: spelling, how readable the text is on a phone, spacing, whether it matches Club Wealth's navy and gold look, and whether the main message is clear in 2 seconds.
List what to fix, most important first, and suggest a better headline if mine is weak.`,
  },
  {
    id: 'carousel',
    group: 'Graphics',
    title: 'Carousel outline',
    hint: 'Slide-by-slide text for a carousel',
    tasks: ['jaymar-6', 'jaymar-4'],
    prompt: `Plan a [5–7] slide carousel about: [topic].
For each slide give the headline (max 8 words) and one supporting line. Slide 1 is the hook, the last slide is the call to action: [follow us / comment / register at (link)].
If I say "make it", design the slides as portrait 1080x1350 graphics.`,
  },
  {
    id: 'repurpose',
    group: 'Repurpose',
    title: 'One input → many posts',
    hint: 'Paste a transcript, testimonial or notes',
    tasks: ['jaymar-10', 'jaymar-4', 'jaymar-5'],
    prompt: `Here is my source content: [paste a video transcript, testimonial, training notes or event recap — or attach a PDF].
Turn it into:
1. A Facebook Page post
2. A Facebook Group discussion post
3. An Instagram caption with hashtags
4. 3 Threads posts
5. 3 short quote lines I can put on graphics
6. One call to action line
Keep every piece true to the source; don't add facts that aren't in it.`,
  },
  {
    id: 'video-script',
    group: 'Repurpose',
    title: 'Short video script (Reel)',
    hint: '30–45 seconds, hook first',
    tasks: ['jaymar-4', 'jaymar-10'],
    prompt: `Write a 30–45 second Reel script about: [topic].
Format: Hook (first 3 seconds), 3 quick points, call to action. Add on-screen text for each part and a short caption.
Speaker: [who is on camera, or voiceover].`,
  },
  {
    id: 'event-promo',
    group: 'Events',
    title: 'Half-Day event promo',
    hint: 'Countdown posts for an event',
    tasks: ['jaymar-7', 'jaymar-9'],
    prompt: `Write promo posts for our Half-Day event.
Event: [event name], [city], [date and time], register at [link].
Give me: an announcement post, a "1 week to go" post, a "tomorrow" reminder, and a "happening today" post. Each under 100 words with a clear register call to action.
If GRAPHICS are available, also make a 1920x1080 event cover image.`,
  },
  {
    id: 'testimonial',
    group: 'Clients',
    title: 'Testimonial post',
    hint: 'Paste the client’s own words',
    tasks: ['jaymar-4', 'jaymar-6'],
    prompt: `Turn this client testimonial into a post: [paste their words exactly].
Client: [first name, business, city] — only use what I give you.
Write a short Facebook caption that tells the before → after in their words, and pull out one quote line for a graphic. Don't change or exaggerate what they said.`,
  },
  {
    id: 'welcome',
    group: 'Clients',
    title: 'New client welcome post',
    hint: 'Page + Group versions',
    tasks: ['jaymar-1'],
    prompt: `Write a welcome post for a new Club Wealth client.
Name: [name], business: [business], city: [city], coach: [coach name].
Give a Facebook Page version (warm, public) and a Group version (more personal, invites members to say hi). Under 70 words each. No details I didn't give you.`,
  },
  {
    id: 'week-plan',
    group: 'Planning',
    title: 'Plan next week’s posts',
    hint: 'A full week, mixed post types',
    tasks: ['jaymar-9', 'jaymar-4'],
    prompt: `Plan next week's posts for the Club Wealth Facebook Page, Group and Instagram.
Include: [1 event promo, 1 testimonial, 1 educational tip, 1 engagement post, 1 recurring Monday post].
For each day give: post type, platform, time, a one-line idea, and the hook. Put it in a table so I can add it to the content calendar.`,
  },
  {
    id: 'content-ideas',
    group: 'Planning',
    title: '20 content ideas',
    hint: 'Fresh ideas around a theme',
    tasks: ['jaymar-4', 'jaymar-5', 'jaymar-9'],
    prompt: `Give me 20 post ideas for Club Wealth around the theme: [theme, e.g. cash flow, hiring, real estate, mindset].
Group them into: tips, stories, questions, myths vs facts, and behind the scenes. One line each, with the best platform for it.`,
  },
];

/** Templates for a task: the ones made for it first, then the rest. */
export function templatesFor(taskId: string) {
  const mine = CONTENT_TEMPLATES.filter((t) => t.tasks?.includes(taskId));
  return { mine, rest: CONTENT_TEMPLATES.filter((t) => !mine.includes(t)) };
}
