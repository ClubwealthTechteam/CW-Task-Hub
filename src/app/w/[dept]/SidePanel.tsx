'use client';

// The panel on the right. A tab on its edge slides it closed to a thin strip and back open; the choice is
// remembered in this browser. Tasks with their own tool in the middle (like the content calendar) put the
// assistant here as a tab next to the task details.

import { useEffect, useState, type ReactNode } from 'react';

const KEY = 'cw-panel-collapsed';
const ASK_EVENT = 'cw-ask-assistant';

export interface PanelTab { id: string; label: string; content: ReactNode }

export function SidePanel({ children, tabs, label = 'Task details' }: { children?: ReactNode; tabs?: PanelTab[]; label?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState(tabs?.[0]?.id);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === '1'); } catch { /* private window */ }
  }, []);

  // "Draft caption with assistant" and similar buttons open the panel on the assistant tab.
  useEffect(() => {
    if (!tabs?.some((t) => t.id === 'assistant')) return;
    const on = () => { setCollapsed(false); setActive('assistant'); };
    window.addEventListener(ASK_EVENT, on);
    return () => window.removeEventListener(ASK_EVENT, on);
  }, [tabs]);

  function toggle() {
    setCollapsed((c) => {
      try { localStorage.setItem(KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  }

  // Contents stay mounted while collapsed, so a chat keeps its place and still hears requests.
  return (
    <aside className={`ws-panel-wrap${collapsed ? ' collapsed' : ''}${tabs ? ' tabbed' : ''}`} aria-label={label}>
      <button className="ws-panel-tab" onClick={toggle} aria-expanded={!collapsed}
        aria-label={collapsed ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`} title={collapsed ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={collapsed ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
        </svg>
      </button>
      {collapsed && <button className="ws-panel-rail" onClick={toggle} tabIndex={-1} aria-hidden="true"><span>{label}</span></button>}
      {tabs ? (
        <div className="ws-ptabs-wrap" hidden={collapsed}>
          <div className="ws-ptabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} role="tab" id={`ptab-${t.id}`} aria-selected={active === t.id} aria-controls={`ppanel-${t.id}`} className={active === t.id ? 'on' : ''} onClick={() => setActive(t.id)}>{t.label}</button>
            ))}
          </div>
          {tabs.map((t) => (
            <div key={t.id} role="tabpanel" id={`ppanel-${t.id}`} aria-labelledby={`ptab-${t.id}`} hidden={active !== t.id} className={`ws-ptab-body${t.id === 'assistant' ? ' chat' : ' ws-panel'}`}>
              {t.content}
            </div>
          ))}
        </div>
      ) : (
        <div className="ws-panel" hidden={collapsed}>{children}</div>
      )}
    </aside>
  );
}
