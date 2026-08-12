import React from 'react';
import type { V } from '../Whiteboard';

export function FooterBar({ v }: { v: V }) {
  return (
    <footer style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '7px 14px', background: 'var(--panel)', borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={v.act.zoomOut} aria-label="Zoom out" style={{ width: 22, height: 22, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--panel)', lineHeight: 1 }}>−</button>
        <button type="button" onClick={v.act.zoomReset} style={{ minWidth: 52, height: 22, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--panel)', fontSize: 11 }} title="Reset zoom">{v.zoomLabel}</button>
        <button type="button" onClick={v.act.zoomIn} aria-label="Zoom in" style={{ width: 22, height: 22, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--panel)', lineHeight: 1 }}>+</button>
        <button type="button" onClick={v.act.fit} style={{ height: 22, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--panel)', fontSize: 11 }}>Fit</button>
      </div>
      <span>{v.countLabel}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: v.saveDot }} />{v.saveLabel}</span>
      <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{v.live}</span>
    </footer>
  );
}
