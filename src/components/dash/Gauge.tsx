// A segmented half-circle gauge (like a speedometer): the share of automations that are live.

export function Gauge({ pct, label }: { pct: number; label: string }) {
  const n = 16, filled = Math.round((pct / 100) * n);
  const cx = 120, cy = 118, r1 = 74, r2 = 108;
  const segs = Array.from({ length: n }, (_, i) => {
    const gap = 0.035;
    const a0 = Math.PI + (i / n) * Math.PI + gap, a1 = Math.PI + ((i + 1) / n) * Math.PI - gap;
    const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    return { d: `M${p(r1, a0)} L${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)}Z`, on: i < filled, fade: filled ? i / Math.max(1, filled - 1) : 0 };
  });
  return (
    <svg className="dgauge" viewBox="0 0 240 132" role="img" aria-label={`${pct}% ${label}`}>
      {segs.map((s, i) => <path key={i} d={s.d} className={s.on ? 'g-on' : 'g-off'} style={s.on ? { opacity: 1 - s.fade * 0.45 } : undefined} strokeLinejoin="round" />)}
      <text x="120" y="108" textAnchor="middle" className="g-n">{pct}%</text>
      <text x="120" y="127" textAnchor="middle" className="g-l">{label}</text>
    </svg>
  );
}
