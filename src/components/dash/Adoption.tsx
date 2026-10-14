// Super admin home: how the team is taking to the hub. Who opened it, who used the assistant, which tasks.

import type { AdoptionData } from '@/lib/adoption';
import { ShowMore } from './ShowMore';

const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const LABEL = ['Didn’t open the hub', 'Opened the hub', 'Used the assistant'];

export function Adoption({ data }: { data: AdoptionData }) {
  const change = data.activeWeek - data.activePrev;
  const today = data.days[data.days.length - 1];
  return (
    <section className="dcard" aria-labelledby="ad-title">
      <div className="dcard-h">
        <div><h2 id="ad-title">Team adoption</h2><p className="muted small">The {data.members} team members, last 14 days · super admins not counted</p></div>
        <ul className="ad-legend" aria-label="Legend">
          <li><i className="ad-c2" />Used the assistant</li><li><i className="ad-c1" />Opened the hub</li><li><i className="ad-c0" />Not active</li>
        </ul>
      </div>
      <div className="ad-kpis">
        <div><span>Active this week</span><b>{data.activeWeek}<small> / {data.members}</small></b>
          <em className={change > 0 ? 'up' : change < 0 ? 'down' : ''}>{change === 0 ? 'same as last week' : `${change > 0 ? '+' : ''}${change} vs last week`}</em></div>
        <div><span>Messages per active person</span><b>{data.perActive}</b><em>this week</em></div>
        <div><span>Tasks people used</span><b>{data.tasksUsed}<small> / {data.totalTasks}</small></b><em>chatted with in the last 4 weeks</em></div>
        <div><span>Haven’t opened it yet</span><b>{data.neverOpened.length}</b><em title={data.neverOpened.join(', ')}>{data.neverOpened.length ? data.neverOpened.slice(0, 3).map((n) => n.split(/\s+/)[0]).join(', ') + (data.neverOpened.length > 3 ? '…' : '') : 'everyone has'}</em></div>
      </div>
      <ShowMore label={`View all ${data.rows.length} people`}>
      <div className="dtable-wrap">
        <table className="dtable ad-table">
          <thead><tr><th>Person</th><th>Last 14 days</th><th className="num">Days active</th><th className="num">Messages · 7d</th><th className="num">Tasks used</th><th>Last active</th></tr></thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td><div className="dwho"><span className="dava">{r.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</span><span>{r.name}<br /><span className="muted small">{r.dept}</span></span></div></td>
                <td><span className="ad-strip" role="img" aria-label={`${r.activeDays14} of 14 days active`}>
                  {r.strip.map((v, i) => <i key={i} className={`ad-c${v}`} title={`${short(data.days[i])}: ${LABEL[v]}`} />)}
                </span></td>
                <td className="num">{r.activeDays14}</td>
                <td className="num">{r.messages7}</td>
                <td className="num">{r.tasksUsed}</td>
                <td className="muted small">{r.lastActive ? (r.lastActive === today ? 'Today' : short(r.lastActive)) : 'Not yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Counting started with this update, so days before it only show assistant messages.</p>
      </ShowMore>
    </section>
  );
}
