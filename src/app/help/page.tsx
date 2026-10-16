// Help: how to use the CW AI Task Hub, step by step. Plain language for the whole team; an extra section for
// super admins. Keep this in step with the features (see the README's "Before launch" note).

import Link from 'next/link';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { dailyLimit } from '@/lib/chat/usage';
import { TourButton } from '@/components/Tour';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Help · CW AI Task Hub' };

function Guide({ id, title, time, steps, tip }: { id: string; title: string; time: string; steps: React.ReactNode[]; tip?: React.ReactNode }) {
  return (
    <section className="card guide" id={id}>
      <div className="spread"><h2>{title}</h2><span className="muted small">{time}</span></div>
      <ol>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {tip && <p className="guide-tip">{tip}</p>}
    </section>
  );
}

export default async function HelpPage() {
  const user = await requireUser();
  const admin = isSuperAdmin(user);
  const home = admin ? '/' : `/w/${user.departments[0]}`;
  const guides = [
    ['start', 'Your first sign-in'], ['task', 'Work a task with its assistant'], ['drafts', 'Use a draft'],
    ['keap', 'Look up a Keap contact'], ['sheets', 'Add your spreadsheets'], ['forms', 'See your process forms'],
    ['bubble', 'Ask CW Assistant anything'], ['faq', 'Questions'],
  ];
  return (
    <>
      <Header user={user} current="help" />
      <main className="page help">
        <section className="hero">
          <span className="eyebrow">Help</span>
          <h1>How to use the CW AI Task Hub</h1>
          <p>Short, step-by-step guides. Each one takes a minute or two.</p>
          <div className="row"><TourButton href={home} /></div>
        </section>

        <nav className="card help-toc" aria-label="Guides">
          {guides.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
          {admin && <a href="#admins">For super admins</a>}
        </nav>

        <Guide id="start" title="Your first sign-in" time="1 min" steps={[
          <>Go to <b>cw-admin-hub.vercel.app</b> (or the AI Task Hub tab in CW University).</>,
          <>Pick <b>your name</b> and type <b>your own access code</b> (Miguel sends it to you). Don’t share it; it’s only for you.</>,
          <>You land in your department’s workspace. On the left are <b>your tasks</b>; nobody else sees them.</>,
          <>A short tour shows you around the first time. You can replay it any time from this page.</>,
        ]} tip={<>Five wrong codes in a row lock your name for 15 minutes. If you forget your code, ask Miguel.</>} />

        <Guide id="task" title="Work a task with its assistant" time="2 min" steps={[
          <>Click a task on the left. <b>From my process form</b> holds the processes you described in the Workflow Process Form; <b>My tasks</b> holds the ones from the AI audit.</>,
          <>In the middle is that task’s assistant. Type what you’re working on, for example <i>“Draft a reminder for tomorrow’s 2pm call with Maria”</i>, and press <b>Enter</b>.</>,
          <>The reply arrives in about <b>1–2 minutes</b>; the dots show it’s working. You can keep working meanwhile.</>,
          <>Ask follow-ups in the same chat, or press <b>New chat</b> to start fresh. Each task remembers its own chat.</>,
          <>The panel on the right shows what the task does, the tools it uses, and its build plan. Click the <b>›</b> tab on its edge to hide it and give the chat more room.</>,
        ]} tip={<>You have <b>{dailyLimit()} assistant messages per day</b>; they reset at midnight (Pacific). The number left shows under the chat box.</>} />

        <Guide id="drafts" title="Use a draft" time="1 min" steps={[
          <>When the assistant writes something to send (an email, a text, a post), it appears as a <b>Draft</b> card.</>,
          <><b>Edit</b> puts the draft in the chat box so you can change it; <b>Shorter</b> asks for a shorter version; <b>Copy</b> copies it.</>,
          <>For emails, <b>Open in Outlook</b> or <b>Open in Gmail</b> opens a new email with the subject, text and (if you picked one) the Keap contact filled in. <b>Read it, then press Send there.</b></>,
          <><b>Approve</b> is greyed out for now: it switches on once that task is fully built and approved.</>,
        ]} tip={<>The hub never sends anything by itself. You always review and send.</>} />

        <Guide id="keap" title="Look up a Keap contact" time="1 min" steps={[
          <>Open a task that uses Keap. In the right panel, under <b>Keap contact</b>, type a name or email.</>,
          <>Click the right person to see their <b>tags</b>.</>,
          <>The assistant now uses that contact’s real details from Keap (tags, notes, recent emails and tasks) in its replies and drafts. You can also just put a client’s email address in your message.</>,
        ]} tip={<>The hub can only <b>read</b> Keap. It can’t change, tag or email anyone in Keap.</>} />

        <Guide id="sheets" title="Add your spreadsheets" time="2 min" steps={[
          <>Click <b>My spreadsheets</b> at the bottom left.</>,
          <>Give the sheet a name, paste its Google Sheets link, pick the account it’s in (normally the marketing Gmail), and tick the tasks it’s used for. Click <b>Add spreadsheet</b>.</>,
          <>So the assistant can read it: open the sheet in Google Sheets → <b>Share</b> → add the hub’s email shown on that page as <b>Viewer</b>.</>,
          <>Back in the hub, the sheet shows <b>✓ Hub can read it</b>. From then on, the task’s assistant can see its first rows.</>,
        ]} tip={<>Sheets must be in the marketing Gmail or an account Miguel approved. The hub only reads them; it never edits a sheet.</>} />

        <Guide id="forms" title="See your process forms" time="1 min" steps={[
          <>Click <b>My process forms</b> at the bottom left to see what you submitted in the Workflow Process Form, drawn as a flowchart: one box per step, with YES / NO branches.</>,
          <>Each process is also a task under <b>From my process form</b>. Its right panel shows the <b>build plan</b>: every step marked <b>Reads</b>, <b>Drafts for you</b>, <b>Needs approval</b> or <b>Assists</b>.</>,
          <><b>Needs approval</b> means the step would change something (like charging a card or tagging a contact), so it stays off until Miguel and Tara approve it.</>,
        ]} tip={<>Submitted the form again? New answers show up here within about 5 minutes.</>} />

        <Guide id="bubble" title="Ask CW Assistant anything" time="1 min" steps={[
          <>Click the round chat button at the bottom right, on any page.</>,
          <>Ask a general question: an email draft, a formula, a summary, a Keap or event question.</>,
          <>Use the icons at the top to see your chats, start a new one, make the window bigger, or minimize it.</>,
        ]} />

        <section className="card guide" id="faq">
          <h2>Questions</h2>
          <dl className="faq">
            <dt>The reply didn’t come back.</dt><dd>Replies take 1–2 minutes. After 10 minutes it shows as failed and you can ask again.</dd>
            <dt>Why is Approve greyed out?</dt><dd>The task is still being built. Use Copy or Open in Outlook / Gmail and send it yourself.</dd>
            <dt>Can the hub change things in Keap, Eventbrite or my sheets?</dt><dd>No. It can only read them for now.</dd>
            <dt>I don’t see one of my tasks.</dt><dd>Fill in (or update) the Workflow Process Form; each process becomes a task. Or tell Miguel.</dd>
            <dt>Who can see my tasks and chats?</dt><dd>Only you. Miguel, Camille and Omerson can see every department’s tasks to help, but not your chats.</dd>
          </dl>
        </section>

        {admin && (
          <section className="card guide" id="admins">
            <h2>For super admins (Miguel, Camille, Omerson)</h2>
            <ul>
              <li><b>Overview</b> (<Link href="/">home</Link>): every department, recent runs, and <b>Preview someone’s view</b> to check exactly what a team member sees (read-only; their chats stay hidden).</li>
              <li><b>Updates &amp; announcements</b> (home page): post news for everyone or one department, and pin what matters. Team members see the newest one as a banner at the top of their workspace until they read it; all of them are on the <Link href="/updates">Updates</Link> page.</li>
              <li><b>Departments</b> in the top bar: each person’s tasks fold into a dropdown in the sidebar.</li>
              <li><b>Integrations ▾</b>: Keap and Eventbrite (view-only tabs), Zapier (live feed of Zap updates, starting approved Zaps), Google Sheets, and <b>Manage integrations</b>.</li>
              <li><b>Spreadsheets</b> page in any department: everyone’s sheets there, and <b>Approved accounts</b> for sheets outside the marketing Gmail.</li>
              <li>You have no daily message limit. Team members get {dailyLimit()} a day.</li>
              <li>Access codes, the assistant, and integrations are set in Vercel (see the README).</li>
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
