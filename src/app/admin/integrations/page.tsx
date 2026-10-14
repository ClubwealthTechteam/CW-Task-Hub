import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { canManageIntegrations } from '@/lib/access';
import { builtinIntegrations, plannedIntegrations } from '@/lib/integrations/registry';
import { KEAP_READS } from '@/lib/integrations/keap/capabilities';
import { zapierHooks } from '@/lib/integrations/zapier';
import { listCustom, toPublic } from '@/lib/integrations/custom';
import { storeIsPersistent } from '@/lib/store';
import { ActionConsole } from './ActionConsole';
import { CustomIntegrations } from './CustomIntegrations';
import { ZapierPanel } from './ZapierPanel';
import { AdminTabs } from '@/components/admin/AdminTabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Integrations · Admin settings · CW AI Task Hub' };

const STATUS_LABEL = { connected: 'Connected', not_connected: 'Not connected', planned: 'Planned' } as const;

export default async function IntegrationsPage() {
  const user = await requireUser();
  if (!canManageIntegrations(user)) notFound();
  const builtins = builtinIntegrations();
  const keap = builtins.find((b) => b.id === 'keap')!;
  const custom = (await listCustom()).map(toPublic);

  return (
    <>
      <Header user={user} current="settings" />
      <main className="page">
        <AdminTabs current="integrations">
          <p className="adm-lead">Connect the tools the automations use. Keys live in Vercel environment variables or on the server, never in the browser.</p>
        </AdminTabs>

        {!storeIsPersistent() && (
          <p className="note">Storage isn&apos;t connected, so integrations you add and the run log reset when the server restarts. Add Upstash Redis in Vercel → Storage to keep them.</p>
        )}

        <section className="grid">
          {builtins.map((b) => (
            <div key={b.id} className="card">
              <div className="spread"><h2>{b.name}</h2><span className={`pill ${b.status === 'connected' ? 'live' : ''}`}>{STATUS_LABEL[b.status]}</span></div>
              <p className="muted small" style={{ margin: 0 }}>{b.description}</p>
              {b.status !== 'connected' && b.envKeys && <p className="small" style={{ margin: 0 }}>Turn on with <code>{b.envKeys.join(', ')}</code> in Vercel.</p>}
            </div>
          ))}
        </section>

        <section className="card" aria-labelledby="keap-title">
          <div className="spread"><h2 id="keap-title">Keap shortcuts</h2><span className="muted small">{KEAP_READS.length} views · read-only</span></div>
          <p className="muted small" style={{ margin: 0 }}>View-only: the hub can read everything in Keap but never changes it. Browse it all in the Keap tab.</p>
          <ActionConsole name="Keap" endpoint="/api/integrations/keap" capabilities={KEAP_READS} connected={keap.status === 'connected'} />
        </section>

        <section className="card" aria-labelledby="zap-title">
          <h2 id="zap-title">Zapier</h2>
          <ZapierPanel zaps={Object.keys(zapierHooks())} />
        </section>

        <section className="card" aria-labelledby="custom-title">
          <h2 id="custom-title">Add an integration</h2>
          <p className="muted small" style={{ margin: 0 }}>Connect any tool with a webhook or REST API. Automations can send it data, and you can test it here.</p>
          <CustomIntegrations initial={custom} />
        </section>

        <section className="card">
          <h2>Planned integrations</h2>
          <p className="muted small" style={{ margin: 0 }}>Tools the audit requests need. Add any of these above as a custom integration, or build them in.</p>
          <div className="row">{plannedIntegrations().map((p) => <span key={p.id} className="chip">{p.name}</span>)}</div>
        </section>
      </main>
    </>
  );
}
