import { PEOPLE } from '@/config/people';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in · CW AI Task Hub' };

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  const people = PEOPLE.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <main className="login">
      <div className="card">
        <div className="brand" style={{ color: 'var(--ink)' }}>
          <b>CLUBWEALTH</b>
          <span>ADMIN HUB</span>
        </div>
        <h1 style={{ fontSize: 20 }}>Sign in</h1>
        <p className="muted small" style={{ margin: 0 }}>Pick your name and enter your own access code. You'll only see your department&apos;s tools.</p>
        <LoginForm people={people} next={searchParams.next} />
      </div>
    </main>
  );
}
