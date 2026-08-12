import React from 'react';
import type { V } from '../Whiteboard';

export function Gallery({ v }: { v: V }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--app)', overflowY: 'auto', zIndex: 20, padding: '22px 26px 44px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <button type="button" onClick={v.act.toCanvas} className="hv-soft-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 0 9px -6px', padding: '5px 9px 5px 6px', border: 'none', borderRadius: 5, background: 'transparent', color: 'var(--muted)', fontSize: 12.5 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
              {v.backLabel}
            </button>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.012em' }}>Your work</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{v.galleryMeta}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>Search scenes by name</label>
            <input id="q" type="search" value={v.q} onChange={v.act.search} placeholder="Search scenes" className="fc-accent" style={{ width: 190, padding: '7px 10px', border: '1px solid var(--line-2)', borderRadius: 5, background: 'var(--panel)', fontSize: 13, outline: 'none' }} />
            <button type="button" onClick={v.act.newFromGallery} className="hv-primary" style={{ padding: '7px 14px', border: '1px solid var(--accent)', borderRadius: 5, background: 'var(--accent)', color: '#FFFFFF', fontWeight: 500, fontSize: 13 }}>New scene</button>
          </div>
        </div>

        {v.galleryEmpty ? (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 9, padding: '38px 30px', textAlign: 'center', maxWidth: 460, margin: '40px auto' }}>
            <div style={{ width: 34, height: 34, border: '2px dashed var(--line-2)', borderRadius: 6, margin: '0 auto 14px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>{v.galleryEmptyTitle}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.6, color: 'var(--muted)', textWrap: 'pretty' } as React.CSSProperties}>{v.galleryEmptyBody}</p>
            <button type="button" onClick={v.act.newFromGallery} className="hv-primary" style={{ padding: '7px 14px', border: '1px solid var(--accent)', borderRadius: 5, background: 'var(--accent)', color: '#FFFFFF', fontWeight: 500, fontSize: 13 }}>Start a scene</button>
          </div>
        ) : null}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(238px,1fr))', gap: 16 }}>
          {v.gallery.map((g) => (
            <li key={g.id} style={{ background: 'var(--panel)', border: '1px solid ' + g.ring, borderRadius: 9, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <button type="button" onClick={g.open} aria-label={g.openLabel} className="hv-panel2" style={{ border: 'none', borderBottom: '1px solid var(--app)', background: 'var(--panel)', padding: 0, height: 150, display: 'grid', placeItems: 'center', width: '100%' }}>
                {g.hasThumb ? <img src={g.thumb} alt={g.alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 10, display: 'block' }} /> : null}
                {g.blank ? <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: 'var(--line-2)' }}>empty scene</span> : null}
              </button>
              <div style={{ padding: '10px 12px 11px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                  {g.badge ? (
                    <span style={{ flex: 'none', fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, letterSpacing: '0.05em', background: 'var(--soft)', color: 'var(--text-2)', border: '1px solid var(--soft-2)', borderRadius: 3, padding: '1px 4px' }}>SAMPLE</span>
                  ) : null}
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: "'IBM Plex Mono',monospace" }}>{g.meta}</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  <button type="button" onClick={g.dup} aria-label={g.dupLabel} className="hv-accent" style={{ flex: 1, padding: '5px 0', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 11.5 }}>Duplicate</button>
                  <button type="button" onClick={g.json} aria-label={g.jsonLabel} className="hv-accent" style={{ flex: 1, padding: '5px 0', border: '1px solid var(--line-2)', borderRadius: 4, background: 'var(--panel)', fontSize: 11.5, fontFamily: "'IBM Plex Mono',monospace" }}>.json</button>
                  <button type="button" onClick={g.del} aria-label={g.delLabel} className="hv-del" style={{ flex: 'none', width: 28, padding: '5px 0', border: '1px solid var(--bad-line)', borderRadius: 4, background: 'var(--panel)', color: '#B3261E', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {v.signedOut ? (
          <p style={{ margin: '22px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, textWrap: 'pretty' } as React.CSSProperties}>Every scene here lives in this browser's IndexedDB, under this origin. Clearing site data deletes them. Use <strong style={{ fontWeight: 500 }}>.json</strong> for backups, or <button type="button" onClick={v.act.signIn} style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--accent)', font: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>sign in</button> to keep them in your account.</p>
        ) : null}
        {v.signedIn ? (
          <p style={{ margin: '22px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, textWrap: 'pretty' } as React.CSSProperties}>This gallery is your account's, not this browser's — it looks the same everywhere you sign in. Clearing site data here costs you nothing.</p>
        ) : null}
      </div>
    </div>
  );
}
