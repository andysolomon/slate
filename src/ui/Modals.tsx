import React from 'react';
import type { V } from '../Whiteboard';

export function Modals({ v }: { v: V }) {
  return (
    <>
      {v.help ? (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--shadow)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 50 }}>
          <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" style={{ width: '100%', maxWidth: 520, background: 'var(--panel)', borderRadius: 10, padding: '22px 24px', boxShadow: '0 20px 50px var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Keyboard</h2>
              <button type="button" onClick={v.act.help} style={{ border: 'none', background: 'transparent', fontSize: 20, lineHeight: 1, color: 'var(--muted)' }} aria-label="Close">×</button>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 20px' }}>
              {v.keys.map((k) => (
                <li key={k.what} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, borderBottom: '1px solid var(--app)', paddingBottom: 5 }}>
                  <span style={{ color: 'var(--muted)' }}>{k.what}</span>
                  <kbd style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, background: 'var(--app)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>{k.key}</kbd>
                </li>
              ))}
            </ul>
            <p style={{ margin: '16px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>Everything is stored in this browser only (IndexedDB). No account, no server, no telemetry. Export to <strong style={{ fontWeight: 500 }}>.json</strong> to move a scene to another browser or to back it up.</p>
          </div>
        </div>
      ) : null}

      {v.authOpen ? (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--shadow)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 50 }}>
          <div role="dialog" aria-modal="true" aria-label="Sign in to Slate" style={{ width: '100%', maxWidth: 392, background: 'var(--panel)', borderRadius: 10, padding: 24, boxShadow: '0 20px 50px var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>Sign in to Slate</h2>
              <button type="button" onClick={v.act.authClose} style={{ border: 'none', background: 'transparent', fontSize: 20, lineHeight: 1, color: 'var(--muted)' }} aria-label="Close">×</button>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.6, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>Your gallery moves to your account. Sign in from any browser and every scene is there, on the version you left it.</p>

            <div style={{ position: 'relative' }}>
              <button type="button" onClick={v.act.google} disabled={v.authBusy} className="hv-accent" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 14px', border: '1px solid var(--line-2)', borderRadius: 6, background: 'var(--panel)', color: 'inherit', fontSize: 13.5, fontWeight: 500, opacity: v.authOp }}>
                <span style={{ width: 19, height: 19, flex: 'none', border: '1px solid var(--line-2)', borderRadius: 4, display: 'grid', placeItems: 'center', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: 'var(--muted)' }}>G</span>
                {v.authCta}
              </button>
              {v.googleConfigured && !v.authBusy ? (
                <div ref={v.googleBtnRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: 0.0001, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
              ) : null}
            </div>

            <div style={{ margin: '16px 0 0', padding: '11px 13px', background: 'var(--app)', border: '1px solid var(--line)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{v.uploadTitle}</span>
              <span style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>{v.uploadBody}</span>
            </div>

            <p style={{ margin: '14px 0 0', fontSize: 11.5, lineHeight: 1.6, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>Scenes are written to private cloud storage on your account. Nothing is public, and nothing is shared until you share it.</p>
          </div>
        </div>
      ) : null}

      {v.accountOpen ? (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--shadow)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 50 }}>
          <div role="dialog" aria-modal="true" aria-label="Account" style={{ width: '100%', maxWidth: 392, background: 'var(--panel)', borderRadius: 10, padding: '22px 24px 20px', boxShadow: '0 20px 50px var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
              <span style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', background: 'var(--accent)', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 600 }}>{v.acctInitial}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, paddingTop: 2 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{v.acctName}</span>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.acctEmail}</span>
              </div>
              <button type="button" onClick={v.act.accountClose} style={{ border: 'none', background: 'transparent', fontSize: 20, lineHeight: 1, color: 'var(--muted)' }} aria-label="Close">×</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: 'var(--app)', border: '1px solid var(--line)', borderRadius: 6, marginBottom: 16 }}>
              <span style={{ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: v.syncDot }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{v.syncLabel}</span>
              <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: 'var(--muted)' }}>{v.syncMeta}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
              <button type="button" onClick={v.act.toggleAuto} aria-pressed={v.autoSync} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Sync as I draw</span>
                  <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>Off means scenes upload when you close them.</span>
                </span>
                <span style={{ width: 32, height: 19, flex: 'none', borderRadius: 10, background: v.autoTrack, padding: 2, display: 'flex', justifyContent: v.autoJustify as 'flex-start' | 'flex-end' }}>
                  <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 2px var(--shadow)' }} />
                </span>
              </button>
              <button type="button" onClick={v.act.toggleCache} aria-pressed={v.keepLocal} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Keep an offline copy</span>
                  <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>Cache scenes in this browser so they open without a connection.</span>
                </span>
                <span style={{ width: 32, height: 19, flex: 'none', borderRadius: 10, background: v.cacheTrack, padding: 2, display: 'flex', justifyContent: v.cacheJustify as 'flex-start' | 'flex-end' }}>
                  <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 2px var(--shadow)' }} />
                </span>
              </button>
            </div>

            <div style={{ height: 1, background: 'var(--line)', margin: '10px 0 14px' }} />

            {v.signOutIdle ? (
              <button type="button" onClick={v.act.askSignOut} className="hv-bad-b" style={{ padding: '7px 14px', border: '1px solid var(--line-2)', borderRadius: 5, background: 'var(--panel)', color: 'inherit', fontSize: 13 }}>Sign out</button>
            ) : null}
            {v.signOutAsk ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>The offline copies in this browser are cleared. Your scenes stay in your gallery and come back the next time you sign in.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={v.act.signOut} style={{ padding: '7px 14px', border: '1px solid #B3261E', borderRadius: 5, background: '#B3261E', color: '#FFFFFF', fontSize: 13, fontWeight: 500 }}>Sign out</button>
                  <button type="button" onClick={v.act.cancelSignOut} className="hv-accent" style={{ padding: '7px 14px', border: '1px solid var(--line-2)', borderRadius: 5, background: 'var(--panel)', color: 'inherit', fontSize: 13 }}>Stay signed in</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
