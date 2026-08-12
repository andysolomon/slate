import React from 'react';
import type { V } from '../Whiteboard';

export function CanvasOverlays({ v }: { v: V }) {
  return (
    <>
      {v.libOpen ? (
        <aside aria-label="Library" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 6, width: 290, background: 'var(--panel)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 24px var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--line)', flex: 'none' }}>
            <strong style={{ fontSize: 13, fontWeight: 600 }}>Library</strong>
            <button type="button" onClick={v.act.libClose} aria-label="Close library" className="hv-app" style={{ marginLeft: 'auto', width: 24, height: 24, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', borderRadius: 4, color: 'var(--muted)', fontSize: 15 }}>×</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {v.libEmpty ? (
              <div style={{ textAlign: 'center', padding: '26px 6px', color: 'var(--muted)', fontSize: 13, textWrap: 'pretty' } as React.CSSProperties}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No libraries yet</div>
                Download a <code style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>.excalidrawlib</code> file from libraries.excalidraw.com, then load it below.
              </div>
            ) : null}
            {v.libs.map((l) => (
              <div key={l.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <strong style={{ fontSize: 12.5, fontWeight: 600 }}>{l.name}</strong>
                  <span style={{ fontSize: 11, color: 'var(--muted-2)', fontFamily: "'IBM Plex Mono',monospace" }}>{l.count}</span>
                  <button type="button" onClick={l.remove} aria-label={l.removeLabel} title="Remove" className="hv-bad" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--muted-2)', fontSize: 11, padding: '2px 4px', borderRadius: 3 }}>Remove</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {l.items.map((it) => (
                    <button key={it.id} type="button" onClick={it.place} title={it.name} aria-label={it.name} className="hv-accent-b" style={{ aspectRatio: '1', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel)', padding: 0, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                      <img src={it.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 'none', padding: '12px 14px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="hv-primary-b" style={{ padding: '7px 0', border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--accent)', color: '#FFFFFF', fontWeight: 500, fontSize: 13, textAlign: 'center', cursor: 'pointer' }}>Load .excalidrawlib
              <input type="file" accept=".excalidrawlib,application/json,.json" onChange={v.act.libImport} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
            </label>
            <a href="https://libraries.excalidraw.com" target="_blank" rel="noreferrer noopener" style={{ textAlign: 'center', fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Browse libraries.excalidraw.com</a>
          </div>
        </aside>
      ) : null}

      {v.penOpen ? (
        <div role="group" aria-label="Pencil mode" style={{ position: 'absolute', left: 12, top: 12, zIndex: 4, display: 'flex', gap: 4, padding: 4, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 6px 18px var(--shadow)' }}>
          <button type="button" onClick={v.penFree.on} aria-pressed={v.penFree.p} aria-label="Freehand" title="Freehand" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: '1px solid ' + v.penFree.ring, borderRadius: 6, background: v.penFree.bg, color: v.penFree.fg }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
          <button type="button" onClick={v.penShape.on} aria-pressed={v.penShape.p} aria-label="Draw to shape" title="Draw to shape — strokes snap to rectangles, ellipses and lines" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: '1px solid ' + v.penShape.ring, borderRadius: 6, background: v.penShape.bg, color: v.penShape.fg }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9.5" cy="9.5" r="6" /><rect x="10.5" y="10.5" width="10" height="10" rx="1.6" /></svg>
          </button>
        </div>
      ) : null}

      <div ref={v.embedLayerRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', transformOrigin: '0 0', pointerEvents: 'none' }} />

      {v.embedOpen ? (
        <div role="dialog" aria-label="Add web embed" style={{ position: 'absolute', left: '50%', top: 24, transform: 'translateX(-50%)', zIndex: 5, width: 'min(440px,90%)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: 16, boxShadow: '0 10px 34px var(--shadow)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Web embed</div>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>Pages served over https only. Many sites refuse to be framed — those show blank.</p>
          <input type="url" placeholder="https://example.com" value={v.embedUrl} onChange={v.act.embedUrl} onKeyDown={v.act.embedKey} className="fc-accent" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 5, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={v.act.embedClose} style={{ padding: '6px 12px', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 13, fontWeight: 500 }}>Cancel</button>
            <button type="button" onClick={v.act.embedAdd} style={{ padding: '6px 12px', border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--accent)', color: '#FFFFFF', fontSize: 13, fontWeight: 500 }}>Add embed</button>
          </div>
        </div>
      ) : null}

      {v.mermaidOpen ? (
        <div role="dialog" aria-label="Mermaid to diagram" style={{ position: 'absolute', left: '50%', top: 24, transform: 'translateX(-50%)', zIndex: 5, width: 'min(520px,92%)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: 16, boxShadow: '0 10px 34px var(--shadow)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Mermaid to diagram</div>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>Flowcharts only, parsed locally: <code style={{ fontFamily: "'IBM Plex Mono',monospace" }}>graph TD</code> / <code style={{ fontFamily: "'IBM Plex Mono',monospace" }}>flowchart LR</code>, <code style={{ fontFamily: "'IBM Plex Mono',monospace" }}>A[Box]</code>, <code style={{ fontFamily: "'IBM Plex Mono',monospace" }}>A(Round)</code>, <code style={{ fontFamily: "'IBM Plex Mono',monospace" }}>A{'{'}Decision{'}'}</code>, <code style={{ fontFamily: "'IBM Plex Mono',monospace" }}>A --&gt; B</code>, <code style={{ fontFamily: "'IBM Plex Mono',monospace" }}>A --&gt;|yes| B</code>.</p>
          <textarea rows={8} value={v.mermaidSrc} onChange={v.act.mermaidSrc} spellCheck={false} className="fc-accent" style={{ width: '100%', padding: '9px 10px', border: '1px solid var(--line-2)', borderRadius: 5, fontSize: 12.5, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={v.act.mermaidClose} style={{ padding: '6px 12px', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 13, fontWeight: 500 }}>Cancel</button>
            <button type="button" onClick={v.act.mermaidGo} style={{ padding: '6px 12px', border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--accent)', color: '#FFFFFF', fontSize: 13, fontWeight: 500 }}>Insert diagram</button>
          </div>
        </div>
      ) : null}

      {v.showEmpty ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', maxWidth: 380, textAlign: 'center', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: '26px 28px', boxShadow: '0 8px 28px var(--shadow)' }}>
            <div style={{ width: 34, height: 34, border: '2px dashed var(--line-2)', borderRadius: 6, margin: '0 auto 14px' }} />
            <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>Empty canvas</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>Press <strong style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500 }}>R</strong> and drag to draw a box, <strong style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500 }}>A</strong> to connect two boxes, or double-click anywhere to type.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" onClick={v.act.starter} className="hv-primary" style={{ padding: '7px 14px', border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--accent)', color: '#FFFFFF', fontWeight: 500, fontSize: 13 }}>Insert two connected boxes</button>
              <button type="button" onClick={v.act.help} className="hv-accent" style={{ padding: '7px 14px', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontWeight: 500, fontSize: 13 }}>Shortcuts</button>
            </div>
          </div>
        </div>
      ) : null}

      {v.loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--panel)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
            <div style={{ width: 14, height: 14, border: '2px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span>Opening your local scene library…</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
