import React from 'react';
import type { V } from '../Whiteboard';

const btn = (bg: string, fg: string): React.CSSProperties =>
  ({ width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid transparent', borderRadius: 6, background: bg, color: fg });

const sep = <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--line)', margin: '3px 0' }} />;

export function ToolRail({ v }: { v: V }) {
  const t = v.tb;
  return (
    <nav aria-label="Tools" style={{ flex: 'none', background: 'var(--panel)', borderRight: '1px solid var(--line)', padding: 8, display: 'grid', gridTemplateColumns: '30px', gridAutoRows: 'auto', gap: 4, overflowY: 'auto', alignContent: 'start' }}>
      <button type="button" onClick={t.v.on} aria-pressed={t.v.p} aria-label="Select and move (V)" title="Select — V" className="hv-line2" style={btn(t.v.bg, t.v.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><polygon points="4,2 14,10 9,10.5 7,15.5" fill="currentColor" /></svg>
      </button>
      <button type="button" onClick={t.h.on} aria-pressed={t.h.p} aria-label="Pan (H, or hold space)" title="Pan — H" className="hv-line2" style={btn(t.h.bg, t.h.fg)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" /><path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.6a5 5 0 0 1-3.9-1.9L5 15c-.6-.8-.4-1.9.4-2.4.7-.4 1.6-.3 2.1.4L9 15V8.5a1.5 1.5 0 0 1 3 0" /></svg>
      </button>
      <button type="button" onClick={t.r.on} aria-pressed={t.r.p} aria-label="Rectangle (R)" title="Rectangle — R" className="hv-line2" style={btn(t.r.bg, t.r.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2.5" y="4.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      <button type="button" onClick={t.o.on} aria-pressed={t.o.p} aria-label="Ellipse (O)" title="Ellipse — O" className="hv-line2" style={btn(t.o.bg, t.o.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      <button type="button" onClick={t.d.on} aria-pressed={t.d.p} aria-label="Diamond (D)" title="Diamond — D" className="hv-line2" style={btn(t.d.bg, t.d.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="4.2" y="4.2" width="9.6" height="9.6" rx="1" transform="rotate(45 9 9)" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      <button type="button" onClick={t.a.on} aria-pressed={t.a.p} aria-label="Arrow connector (A)" title="Arrow — A" className="hv-line2" style={btn(t.a.bg, t.a.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><line x1="3" y1="15" x2="13" y2="5" stroke="currentColor" strokeWidth="1.6" /><polygon points="14.5,3.5 9.6,4.6 13.4,8.4" fill="currentColor" /></svg>
      </button>
      <button type="button" onClick={t.l.on} aria-pressed={t.l.p} aria-label="Line (L)" title="Line — L" className="hv-line2" style={btn(t.l.bg, t.l.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><line x1="3" y1="15" x2="15" y2="3" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      <button type="button" onClick={t.p.on} aria-pressed={t.p.p} aria-label="Freedraw (P)" title="Freedraw — P" className="hv-line2" style={btn(t.p.bg, t.p.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><polyline points="3,12 6,6.5 9,12 12,5.5 15,10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" onClick={t.t.on} aria-pressed={t.t.p} aria-label="Text (T)" title="Text — T" className="hv-line2" style={{ ...btn(t.t.bg, t.t.fg), fontWeight: 600, fontSize: 16 }}>T</button>
      <button type="button" onClick={t.s.on} aria-pressed={t.s.p} aria-label="Sticky note (S)" title="Sticky note — S" className="hv-line2" style={btn(t.s.bg, t.s.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3.5" y="3.5" width="11" height="11" rx="1" fill="#FFF3C0" stroke="currentColor" strokeWidth="1.4" /><line x1="6" y1="7.5" x2="12" y2="7.5" stroke="currentColor" strokeWidth="1.2" /><line x1="6" y1="10.5" x2="10" y2="10.5" stroke="currentColor" strokeWidth="1.2" /></svg>
      </button>
      {sep}
      <button type="button" onClick={t.f.on} aria-pressed={t.f.p} aria-label="Frame (F)" title="Frame — F" className="hv-line2" style={btn(t.f.bg, t.f.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="5.5" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2" /><line x1="3" y1="3.2" x2="9" y2="3.2" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      <button type="button" onClick={t.i.on} aria-label="Place an image (I)" title="Image — I, or drop a file on the canvas" className="hv-line2" style={btn('transparent', 'var(--muted)')}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2.5" y="4" width="13" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="6.5" cy="7.5" r="1.3" fill="currentColor" /><polyline points="3.5,13 8,9 11,11.6 14.5,8.6" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      <button type="button" onClick={t.e.on} aria-pressed={t.e.p} aria-label="Eraser (E)" title="Eraser — E" className="hv-line2" style={btn(t.e.bg, t.e.fg)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3.4" y="7.4" width="11" height="6" rx="1.2" transform="rotate(-32 9 10.4)" fill="none" stroke="currentColor" strokeWidth="1.4" /><line x1="3" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      {sep}
      <button type="button" onClick={t.k.on} aria-pressed={t.k.p} aria-label="Laser pointer (K)" title="Laser pointer — K" className="hv-line2" style={btn(t.k.bg, t.k.fg)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20 14.5 9.5" /><path d="m13 8 3 3 3.5-3.5a2.1 2.1 0 0 0-3-3Z" /><path d="M6 4v3M4.5 5.5h3M17 16v2.5M15.8 17.2h2.5" /></svg>
      </button>
      <button type="button" onClick={t.b.on} aria-pressed={t.b.p} aria-label="Bucket fill (B)" title="Bucket fill — B" className="hv-line2" style={btn(t.b.bg, t.b.fg)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3.5 18 13.5a1.4 1.4 0 0 1 0 2l-5 5a1.4 1.4 0 0 1-2 0L4 13.5Z" /><path d="M20 17.5c0 1.1-.9 2-2 2s-2-.9-2-2 2-3.5 2-3.5 2 2.4 2 3.5Z" /></svg>
      </button>
      <button type="button" onClick={v.act.embed} aria-label="Web embed" title="Web embed" className="hv-line2" style={btn('transparent', 'var(--muted)')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 7-5 5 5 5" /><path d="m15 7 5 5-5 5" /></svg>
      </button>
      <button type="button" onClick={v.act.mermaid} aria-label="Mermaid to diagram" title="Mermaid to diagram" className="hv-line2" style={btn('transparent', 'var(--muted)')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h6M4 5v14M4 19h6M14 12h6M14 5v14" /><path d="M10 5v0M10 12h4" /></svg>
      </button>
    </nav>
  );
}
