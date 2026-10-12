import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { Chat } from './Chat';

export const dynamic = 'force-dynamic';

export default async function AssistantPage({ searchParams }: { searchParams: { c?: string } }) {
  const user = await requireUser();
  return (
    <>
      <Header user={user} current="assistant" />
      <main className="page">
        <section className="hero">
          <span className="eyebrow">CW Assistant</span>
          <h1>Ask Claude anything about your work</h1>
          <p>Drafts, summaries, step-by-step help and questions about your automations. Replies usually take a minute or two.</p>
        </section>
        <Chat firstName={user.name.split(/\s+/)[0]} initialId={searchParams.c} />
      </main>
    </>
  );
}
