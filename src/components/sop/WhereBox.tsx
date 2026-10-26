// "Where" under an SOP step: the exact sheet, tab and cells (each a link that opens right there), or the app screen.

import type { SopWhere } from '@/data/sop';

const APP_LABEL: Record<SopWhere['app'], string> = { sheet: 'Google Sheet', slack: 'Slack', keap: 'Keap', eventbrite: 'Eventbrite', hub: 'Task Hub' };

export function WhereBox({ where }: { where: SopWhere[] }) {
  if (!where.length) return null;
  return (
    <div className="sop-where">
      <span className="sop-where-h">Where</span>
      <table>
        <thead><tr><th>App</th><th>Sheet / place</th><th>Tab</th><th>Cells / columns</th><th>Do</th></tr></thead>
        <tbody>
          {where.map((w, i) => (
            <tr key={i}>
              <td><span className={`sop-app ${w.app}`}>{APP_LABEL[w.app]}</span></td>
              <td>{w.url ? <a href={w.url} target={w.url.startsWith('#') ? undefined : '_blank'} rel="noreferrer">{w.name}{w.url.startsWith('#') ? '' : ' ↗'}</a> : <b>{w.name}</b>}</td>
              <td>{w.tab ?? <span className="muted">—</span>}</td>
              <td>{w.cells ?? <span className="muted">—</span>}</td>
              <td>{w.action ?? <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
