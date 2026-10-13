import type { Automation } from '@/data/automations';
import { integrationName } from '@/lib/integrations/registry';

export function StagePill({ a }: { a: Automation }) {
  if (a.stage === 'live') return <span className="pill live">Live</span>;
  if (a.stage === 'building') return <span className="pill gold">In progress</span>;
  return <span className="pill">Skeleton</span>;
}

export function ToolChips({ a }: { a: Automation }) {
  return (
    <span className="row">
      {a.integrations.filter((i) => i !== 'claude').map((i) => <span key={i} className="chip">{integrationName(i)}</span>)}
    </span>
  );
}
