import React from 'react';
import type { V } from '../Whiteboard';

type Pick = V['strokePick'];

function ColorPicker({ p, kind }: { p: Pick; kind: 'stroke' | 'fill' }) {
  if (!p.open) return null;
  return (
    <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--line)', borderRadius: 7, background: 'var(--panel-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 6 }}>Colours</div>
        <div role="group" aria-label={'All ' + kind + ' colours'} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
          {p.families.map((f) => (
            <button key={f.label} type="button" onClick={f.on} aria-label={f.label} title={f.label} style={{ aspectRatio: '1', borderRadius: 5, border: '2px solid ' + f.ring, background: f.v, padding: 0, display: 'grid', placeItems: 'center', fontSize: 10, color: '#495057' }}>{f.glyph}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 6 }}>Shades</div>
        {p.hasShades ? (
          <div role="group" aria-label={kind === 'stroke' ? 'Stroke shades' : 'Fill shades'} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
            {p.shades.map((sh) => (
              <button key={sh.label} type="button" onClick={sh.on} aria-label={sh.label} style={{ aspectRatio: '1', borderRadius: 5, border: '2px solid ' + sh.ring, background: sh.v, padding: 0, fontSize: 10, fontWeight: 600, color: sh.fg }}>{sh.n}</button>
            ))}
          </div>
        ) : null}
        {p.noShades ? <div style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>No shades for this colour.</div> : null}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 6 }}>Hex code</div>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line-2)', borderRadius: 5, background: 'var(--panel)', overflow: 'hidden' }}>
          <span style={{ padding: '0 7px', color: 'var(--muted-2)', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>#</span>
          <input type="text" maxLength={kind === 'stroke' ? 7 : 11} spellCheck={false} value={p.hexValue} aria-label={p.hexLabel} onChange={p.onHex} onKeyDown={p.onHexKey}
            style={{ flex: 1, minWidth: 0, border: 'none', padding: '6px 8px 6px 0', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, background: 'transparent', outline: 'none' }} />
        </div>
      </div>
    </div>
  );
}

function PickToggle({ p, label }: { p: Pick; label: string }) {
  return (
    <button type="button" onClick={p.toggle} aria-expanded={p.open} aria-label={label} className="hv-accent-b"
      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--line)', borderRadius: 5, background: 'var(--panel)', padding: '2px 6px 2px 3px' }}>
      <span style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid var(--line)', background: p.current, display: 'grid', placeItems: 'center', fontSize: 10, color: '#495057' }}>{p.currentGlyph}</span>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: 'var(--muted)' }}>{p.currentLabel}</span>
    </button>
  );
}

const segBtn = (s: { ring: string; bg: string; fg: string }): React.CSSProperties =>
  ({ flex: 1, height: 32, display: 'grid', placeItems: 'center', border: '1px solid ' + s.ring, borderRadius: 4, background: s.bg, color: s.fg });

export function SidePanel({ v }: { v: V }) {
  return (
    <aside aria-label="Scenes and style" style={{ flex: 'none', width: 252, background: 'var(--panel)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 'none' }}>
        <button type="button" onClick={v.act.scenes} aria-expanded={v.scenesOpen} aria-label={v.scenesLabel} className="hv-text" style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, margin: 0, color: 'var(--muted)', cursor: 'pointer' }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'rotate(' + v.scenesTurn + ')', transition: 'transform 0.15s ease' }}><path d="M3 4.5 6 8l3-3.5" /></svg>
          <h2 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Scenes</h2>
        </button>
        <button type="button" onClick={v.act.newScene} className="hv-accent" style={{ padding: '3px 9px', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 12, fontWeight: 500 }}>New</button>
      </div>
      {v.scenesOpen ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: '0 8px 8px', maxHeight: 210, overflowY: 'auto', flex: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {v.sceneList.map((s) => (
            <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 5, padding: 2, background: s.bg }}>
              <button type="button" onClick={s.open} aria-current={s.cur === 'true'} className="hv-app" style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', padding: '6px 7px', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: s.fw as unknown as number, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{s.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace" }}>{s.meta}</span>
              </button>
              <button type="button" onClick={s.dup} aria-label={s.dupLabel} title="Duplicate" className="hv-app-text" style={{ width: 24, height: 24, flex: 'none', border: 'none', background: 'transparent', borderRadius: 4, color: 'var(--muted)', fontSize: 13 }}>⧉</button>
              <button type="button" onClick={s.del} aria-label={s.delLabel} title="Delete" className="hv-bad" style={{ width: 24, height: 24, flex: 'none', border: 'none', background: 'transparent', borderRadius: 4, color: 'var(--muted)', fontSize: 15 }}>×</button>
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase' }}>{v.styleTitle}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {v.canStroke ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{v.strokeLabel}</div>
                <PickToggle p={v.strokePick} label="More stroke colours" />
              </div>
              <div role="group" aria-label="Stroke colour" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {v.strokes.map((c) => (
                  <button key={c.label} type="button" onClick={c.on} aria-label={c.label} aria-pressed={c.p} style={{ width: 26, height: 26, borderRadius: 5, border: '2px solid ' + c.ring, background: c.v, padding: 0 }} />
                ))}
              </div>
              <ColorPicker p={v.strokePick} kind="stroke" />
            </div>
          ) : null}
          {v.canFill ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fill</div>
                <PickToggle p={v.fillPick} label="More fill colours" />
              </div>
              <div role="group" aria-label="Fill colour" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {v.fills.map((c) => (
                  <button key={c.label} type="button" onClick={c.on} aria-label={c.label} aria-pressed={c.p} style={{ width: 26, height: 26, borderRadius: 5, border: '2px solid ' + c.ring, background: c.v, padding: 0, fontSize: 11, color: '#495057' }}>{c.glyph}</button>
                ))}
              </div>
              <ColorPicker p={v.fillPick} kind="fill" />
            </div>
          ) : null}
          {v.canSw ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Stroke width</div>
              <div role="group" aria-label="Stroke width" style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={v.sw.thin.on} aria-pressed={v.sw.thin.p} aria-label="Thin" title="Thin" style={segBtn(v.sw.thin)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </button>
                <button type="button" onClick={v.sw.med.on} aria-pressed={v.sw.med.p} aria-label="Medium" title="Medium" style={segBtn(v.sw.med)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                </button>
                <button type="button" onClick={v.sw.bold.on} aria-pressed={v.sw.bold.p} aria-label="Bold" title="Bold" style={segBtn(v.sw.bold)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>
          ) : null}
          {v.canDash ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Stroke style</div>
              <div role="group" aria-label="Stroke style" style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={v.dsh.solid.on} aria-pressed={v.dsh.solid.p} aria-label="Solid" title="Solid" style={segBtn(v.dsh.solid)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
                <button type="button" onClick={v.dsh.dashed.on} aria-pressed={v.dsh.dashed.p} aria-label="Dashed" title="Dashed" style={segBtn(v.dsh.dashed)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" /></svg>
                </button>
                <button type="button" onClick={v.dsh.dotted.on} aria-pressed={v.dsh.dotted.p} aria-label="Dotted" title="Dotted" style={segBtn(v.dsh.dotted)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.5 3.5" /></svg>
                </button>
              </div>
            </div>
          ) : null}
          {v.canRough ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Sloppiness</div>
              <div role="group" aria-label="Sloppiness" style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={v.rgh.clean.on} aria-pressed={v.rgh.clean.p} aria-label="Clean" title="Clean" style={segBtn(v.rgh.clean)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 12c2.5-3 4.5 1 7-1.5S16 6.5 17 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
                <button type="button" onClick={v.rgh.rough.on} aria-pressed={v.rgh.rough.p} aria-label="Rough" title="Rough" style={segBtn(v.rgh.rough)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 12c2.5-3 4.5 1 7-1.5S16 6.5 17 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M3.4 13c2.6-3.4 4.3.6 6.8-2S15.8 7.6 16.6 8.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" /></svg>
                </button>
                <button type="button" onClick={v.rgh.sloppy.on} aria-pressed={v.rgh.sloppy.p} aria-label="Sloppy" title="Sloppy" style={segBtn(v.rgh.sloppy)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 12.5c2.8-4 4.2 1.6 7-1.4s5.6-4.4 7-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M3.6 13.6c2.2-4.6 4.8 1.4 6.6-2.4s5.4-3 6.6-2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" /><path d="M4.2 11.2c2.6-2.4 3.4 2.4 6.2.4s5-4 6.4-2.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" /></svg>
                </button>
              </div>
            </div>
          ) : null}
          {v.canArrow ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Arrowheads</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginBottom: 4 }}>Start</div>
                  <div role="group" aria-label="Start arrowhead" style={{ display: 'flex', gap: 4 }}>
                    {v.tails.map((a) => (
                      <button key={a.v} type="button" onClick={a.on} aria-pressed={a.p} aria-label={'Start ' + a.label} title={a.label} style={{ flex: 1, height: 26, border: '1px solid ' + a.ring, borderRadius: 4, background: a.bg, color: a.fg, fontSize: 10, fontWeight: 500, padding: 0 }}>{a.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginBottom: 4 }}>End</div>
                <div role="group" aria-label="End arrowhead" style={{ display: 'flex', gap: 4 }}>
                  {v.heads.map((a) => (
                    <button key={a.v} type="button" onClick={a.on} aria-pressed={a.p} aria-label={'End ' + a.label} title={a.label} style={{ flex: 1, height: 26, border: '1px solid ' + a.ring, borderRadius: 4, background: a.bg, color: a.fg, fontSize: 10, fontWeight: 500, padding: 0 }}>{a.label}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {v.canCurve ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Arrow type</div>
              <div role="group" aria-label="Arrow type" style={{ display: 'flex', gap: 6 }}>
                {v.curves.map((c) => (
                  <button key={c.v} type="button" onClick={c.on} aria-pressed={c.p} aria-label={c.label} title={c.label} style={{ ...segBtn(c), fontSize: 11.5, fontWeight: 500 }}>{c.label}</button>
                ))}
              </div>
            </div>
          ) : null}
          {v.canToShape ? (
            <button type="button" onClick={v.act.toShape} className="hv-accent" style={{ width: '100%', padding: '7px 0', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 12.5, fontWeight: 500, color: 'var(--muted)' }}>Snap to shape <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: 'var(--muted-2)' }}>⇧X</span></button>
          ) : null}
          <div>
            <label htmlFor="opacity" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Opacity <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{v.opacityLabel}</span></label>
            <input id="opacity" type="range" min={10} max={100} step={5} value={v.opacityVal} onChange={v.act.opacity} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
          {v.canFont ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Text size</div>
              <div role="group" aria-label="Text size" style={{ display: 'flex', gap: 6 }}>
                {v.sizes.map((f) => (
                  <button key={f.label} type="button" onClick={f.on} aria-pressed={f.p} style={{ flex: 1, padding: '6px 0', border: '1px solid ' + f.ring, borderRadius: 4, background: f.bg, fontSize: 12, fontWeight: 500, color: f.fg }}>{f.label}</button>
                ))}
              </div>
            </div>
          ) : null}

          {v.hasSel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{v.selLabel}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button type="button" onClick={v.act.front} className="hv-accent" style={{ padding: '6px 0', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 12 }}>Bring front</button>
                <button type="button" onClick={v.act.back} className="hv-accent" style={{ padding: '6px 0', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 12 }}>Send back</button>
                <button type="button" onClick={v.act.dup} className="hv-accent" style={{ padding: '6px 0', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 12 }}>Duplicate</button>
                <button type="button" onClick={v.act.del} className="hv-del" style={{ padding: '6px 0', border: '1px solid var(--bad-line)', borderRadius: 4, background: 'var(--panel)', color: '#B3261E', fontSize: 12 }}>Delete</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
