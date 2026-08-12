import React from 'react';
import type { V } from '../Whiteboard';

const menuItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', border: 'none', borderRadius: 5, background: 'transparent', color: 'inherit', fontSize: 13, textAlign: 'left' };

export function Header({ v }: { v: V }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', background: 'var(--panel)', borderBottom: '1px solid var(--line)', flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: '#066AFE' }} />
        <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>Slate</span>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: 'var(--muted)', background: 'var(--app)', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 6px' }}>{v.badgeLabel}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <label htmlFor="sceneName" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Scene name</label>
        <input id="sceneName" type="text" maxLength={60} value={v.name} onChange={v.onRename} placeholder="Untitled scene" className="scene-name"
          style={{ width: '100%', maxWidth: 340, border: '1px solid transparent', borderRadius: 4, padding: '5px 8px', fontWeight: 500, background: 'transparent', outline: 'none' }} />
        {v.nameError ? <span role="alert" style={{ fontSize: 12, color: '#B3261E', paddingLeft: 9 }}>{v.nameError}</span> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        <div style={{ display: 'flex', gap: 6, paddingRight: 8, borderRight: '1px solid var(--line)' }}>
          <button type="button" onClick={v.act.undo} disabled={v.noUndo} title="Undo — Ctrl+Z" aria-label="Undo" className="hv-accent"
            style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', color: v.undoFg, opacity: v.undoOp }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h11a5 5 0 0 1 0 10H8" /><path d="M7 4 3 8l4 4" /></svg>
          </button>
          <button type="button" onClick={v.act.redo} disabled={v.noRedo} title="Redo — Ctrl+Y" aria-label="Redo" className="hv-accent"
            style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', color: v.redoFg, opacity: v.redoOp }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 8H10a5 5 0 0 0 0 10h6" /><path d="m17 4 4 4-4 4" /></svg>
          </button>
        </div>
        <div style={{ position: 'relative', display: 'flex' }}>
          <button type="button" onClick={v.act.menu} aria-expanded={v.menuOpen} aria-haspopup="menu" aria-label="Menu" title="Menu" className="hv-accent"
            style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: '1px solid var(--line-2)', borderRadius: 4, background: v.menuBg, color: 'inherit' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          {v.menuOpen ? (
            <div role="menu" aria-label="Main menu" style={{ position: 'absolute', top: 38, right: 0, zIndex: 20, width: 212, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 30px var(--shadow)', padding: 6, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {v.signedOut ? (
                <button type="button" role="menuitem" onClick={v.menu.signIn} className="hv-app" style={{ ...menuItem, padding: '8px 9px' }}>
                  <span style={{ width: 22, height: 22, flex: 'none', border: '1px dashed var(--line-2)', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>Sign in</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Scenes stay on this device</span>
                  </span>
                </button>
              ) : null}
              {v.signedIn ? (
                <button type="button" role="menuitem" onClick={v.menu.account} className="hv-app" style={{ ...menuItem, padding: '8px 9px' }}>
                  <span style={{ width: 22, height: 22, flex: 'none', borderRadius: '50%', background: 'var(--accent)', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600 }}>{v.acctInitial}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.acctName}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.acctEmail}</span>
                  </span>
                  <span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: v.syncDot }} />
                </button>
              ) : null}
              <div style={{ height: 1, background: 'var(--line)', margin: '5px 4px' }} />
              <button type="button" role="menuitem" onClick={v.menu.view} className="hv-app" style={menuItem}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
                {v.menuViewLabel}
              </button>
              <button type="button" role="menuitem" onClick={v.menu.lib} className="hv-app" style={menuItem}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z" /></svg>
                Library
              </button>
              <div style={{ height: 1, background: 'var(--line)', margin: '5px 4px' }} />
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', padding: '4px 9px 3px' }}>Export</div>
              <button type="button" role="menuitem" onClick={v.menu.svg} className="hv-app" style={menuItem}>
                <span style={{ width: 15, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--muted)' }}>SV</span>Scene as SVG
              </button>
              <button type="button" role="menuitem" onClick={v.menu.png} className="hv-app" style={menuItem}>
                <span style={{ width: 15, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--muted)' }}>PN</span>Scene as PNG
              </button>
              <button type="button" role="menuitem" onClick={v.menu.json} className="hv-app" style={menuItem}>
                <span style={{ width: 15, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: 'var(--muted)' }}>JS</span>Scene as JSON
              </button>
              <label role="menuitem" className="hv-app" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
                Import a scene
                <input type="file" accept="application/json,.json" onChange={v.menu.import} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
              </label>
              <div style={{ height: 1, background: 'var(--line)', margin: '5px 4px' }} />
              <button type="button" role="menuitem" onClick={v.menu.theme} className="hv-app" style={menuItem}>
                {v.isDark ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>
                )}
                {v.menuThemeLabel}
                <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: 'var(--muted)' }}>⌥⇧D</span>
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" onClick={v.act.help} aria-haspopup="dialog" className="hv-accent" style={{ width: 30, height: 30, border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontWeight: 600 }} aria-label="Keyboard shortcuts">?</button>
      </div>
    </header>
  );
}
