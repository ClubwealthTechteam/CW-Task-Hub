'use client';

// Keap shortcuts for super admins: pick a view, fill in plain fields, and read the answer as a table.
// The raw API response is still there under "Show raw data" for troubleshooting.

import { useMemo, useState } from 'react';

interface Action { id: string; group: string; label: string; method: string; path: string; hint?: string; writes?: boolean }
type Row = Record<string, string>;

// Optional search fields per view (sent as query parameters). Everything else only needs "How many".
const FILTERS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  'contacts.list': [
    { key: 'email', label: 'Email', placeholder: 'name@example.com' },
    { key: 'given_name', label: 'First name' },
    { key: 'family_name', label: 'Last name' },
  ],
  'emails.list': [{ key: 'contact_id', label: 'Contact ID', placeholder: 'Optional' }],
  'notes.list': [{ key: 'contact_id', label: 'Contact ID', placeholder: 'Optional' }],
  'tasks.list': [{ key: 'contact_id', label: 'Contact ID', placeholder: 'Optional' }],
  'orders.list': [{ key: 'contact_id', label: 'Contact ID', placeholder: 'Optional' }],
  'transactions.list': [{ key: 'contact_id', label: 'Contact ID', placeholder: 'Optional' }],
  'appointments.list': [{ key: 'contact_id', label: 'Contact ID', placeholder: 'Optional' }],
  'opportunities.list': [{ key: 'search_term', label: 'Search', placeholder: 'Name or title' }],
};

const ID_LABEL: Record<string, string> = { contactId: 'Contact ID', tagId: 'Tag ID', campaignId: 'Campaign ID', automationId: 'Automation ID', id: 'Email ID', taskId: 'Task ID', opportunityId: 'Opportunity ID' };

const HEADER: Record<string, string> = {
  given_name: 'First name', family_name: 'Last name', email_addresses: 'Email', phone_numbers: 'Phone', date_created: 'Created',
  last_updated: 'Updated', create_time: 'Created', update_time: 'Updated', product_name: 'Product', product_price: 'Price',
  product_short_desc: 'Description', product_desc: 'Details', sku: 'SKU', subscription_only: 'Subscription only', id: 'ID',
  contact_id: 'Contact', company_name: 'Company', job_title: 'Job title', lead_source_id: 'Lead source', owner_id: 'Owner',
  order_date: 'Order date', total: 'Total', total_paid: 'Paid', total_due: 'Due', sent_date: 'Sent', received_date: 'Received',
  opened_date: 'Opened', due_date: 'Due', completed: 'Done', stage: 'Stage', opportunity_title: 'Opportunity', amount: 'Amount',
  status: 'Status', title: 'Title', name: 'Name', subject: 'Subject', body: 'Text', type: 'Type', email: 'Email',
  given_name_preferred: 'Preferred name', category: 'Category', description: 'Description', locked: 'Locked',
};
// Columns people care about first; the rest follow in the order Keap sends them.
const FIRST = ['given_name', 'family_name', 'name', 'title', 'product_name', 'opportunity_title', 'subject', 'email_addresses', 'email', 'company_name', 'phone_numbers', 'product_price', 'amount', 'total', 'status', 'stage', 'date_created', 'order_date', 'sent_date', 'due_date'];
const HIDE = new Set(['url', 'custom_fields', 'product_options', 'subscription_plans', 'tag_ids', 'addresses', 'fax_numbers', 'social_accounts', 'relationships', 'body', 'product_desc', 'headers', 'html_content', 'plain_content', 'sequences']);
const MAX_COLS = 7;

const header = (k: string) => HEADER[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}T/.test(s);
const money = (k: string) => /price|amount|total|paid|due/.test(k);

function summarize(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(summarize).filter(Boolean).join(', ');
  const o = v as Record<string, unknown>;
  for (const k of ['email', 'number', 'name', 'label', 'title', 'value', 'id']) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return String(o[k]);
  return '';
}

function cell(k: string, v: unknown): string {
  const s = summarize(v);
  if (!s) return '';
  if (typeof v === 'string' && isDate(v)) return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (typeof v === 'number' && money(k)) return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  if (k === 'status' && typeof v === 'number') return v === 1 ? 'Active' : 'Inactive'; // Keap products
  return s;
}

/** The first list in a Keap answer (e.g. data.products), or the answer itself when it's one record. */
function shape(data: unknown): { rows: Row[]; cols: string[]; total?: number } | { record: [string, string][] } | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const list = Array.isArray(data) ? data : Object.values(obj).find(Array.isArray);
  if (Array.isArray(list)) {
    const items = list.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
    const seen = new Map<string, number>();
    for (const it of items.slice(0, 50)) for (const [k, v] of Object.entries(it)) if (!HIDE.has(k) && summarize(v)) seen.set(k, (seen.get(k) ?? 0) + 1);
    const keys = [...seen.keys()];
    const cols = [...FIRST.filter((k) => seen.has(k)), ...keys.filter((k) => !FIRST.includes(k) && k !== 'id')].slice(0, MAX_COLS - (seen.has('id') ? 1 : 0));
    if (seen.has('id')) cols.push('id');
    const rows = items.map((it) => Object.fromEntries(cols.map((k) => [k, cell(k, it[k])])));
    const count = typeof obj.count === 'number' ? obj.count : undefined;
    return { rows, cols, total: count };
  }
  return { record: Object.entries(obj).filter(([k, v]) => !HIDE.has(k) && summarize(v)).map(([k, v]) => [header(k), cell(k, v)]) };
}

export function ActionConsole({ name, endpoint, capabilities, connected }: { name: string; endpoint: string; capabilities: Action[]; connected: boolean }) {
  const [id, setId] = useState(capabilities[0]?.id ?? '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState('10');
  const [result, setResult] = useState<{ ok: boolean; data?: unknown; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const cap = capabilities.find((c) => c.id === id);
  const groups = useMemo(() => [...new Set(capabilities.map((c) => c.group))], [capabilities]);
  const ids = cap ? [...cap.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]) : [];
  const filters = FILTERS[id] ?? [];
  const isList = ids.length === 0 && !/\/model$|\/profile$|event_keys$/.test(cap?.path ?? '');
  const missing = ids.filter((k) => !values[k]?.trim());
  const view = result?.ok ? shape(result.data) : null;

  async function run() {
    const params: Record<string, string | number> = {};
    for (const k of [...ids, ...filters.map((f) => f.key)]) if (values[k]?.trim()) params[k] = values[k].trim();
    if (isList) params.limit = Number(limit);
    setBusy(true);
    try {
      const res = await fetch(`${endpoint}/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ params }) });
      setResult(await res.json().catch(() => ({ ok: false, error: 'No answer from the hub' })));
    } catch { setResult({ ok: false, error: 'Could not reach the hub' }); }
    setBusy(false);
  }

  return (
    <div className="kc">
      <div className="kc-form">
        <div className="field">
          <label htmlFor={`cap-${name}`}>What do you want to see?</label>
          <select id={`cap-${name}`} value={id} onChange={(e) => { setId(e.target.value); setResult(null); }}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {capabilities.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {[...ids.map((k) => ({ key: k, label: ID_LABEL[k] ?? header(k), placeholder: 'Required' })), ...filters].map((f) => (
          <div key={f.key} className="field">
            <label htmlFor={`kc-${f.key}`}>{f.label}</label>
            <input id={`kc-${f.key}`} value={values[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && connected && !missing.length) run(); }} />
          </div>
        ))}
        {isList && (
          <div className="field">
            <label htmlFor={`kc-limit-${name}`}>How many</label>
            <select id={`kc-limit-${name}`} value={limit} onChange={(e) => setLimit(e.target.value)}>
              {['10', '25', '50', '100'].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        <button className="dbtn" onClick={run} disabled={busy || !connected || missing.length > 0}>
          {!connected ? `Connect ${name} first` : busy ? 'Looking…' : missing.length ? `Enter the ${ID_LABEL[missing[0]] ?? missing[0]}` : 'Show'}
        </button>
      </div>

      <div className="kc-out" aria-live="polite">
        {!result && <p className="muted small kc-empty">Pick a view and press Show. The answer appears here as a table.</p>}
        {result && !result.ok && <p className="kc-err">{result.error || 'Keap didn’t answer.'}</p>}
        {view && 'rows' in view && (
          view.rows.length ? (
            <>
              <p className="muted small kc-count">{view.rows.length} shown{view.total && view.total > view.rows.length ? ` of ${view.total.toLocaleString()}` : ''}</p>
              <div className="kc-scroll">
                <table className="kc-table">
                  <thead><tr>{view.cols.map((c) => <th key={c} scope="col">{header(c)}</th>)}</tr></thead>
                  <tbody>{view.rows.map((r, i) => <tr key={i}>{view.cols.map((c) => <td key={c} title={r[c]}>{r[c] || <span className="muted">–</span>}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </>
          ) : <p className="muted small kc-empty">Nothing found.</p>
        )}
        {view && 'record' in view && (
          <dl className="kc-record">{view.record.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        )}
        {result && (
          <details className="kc-raw">
            <summary>Show raw data</summary>
            <pre className="json">{JSON.stringify(result, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
