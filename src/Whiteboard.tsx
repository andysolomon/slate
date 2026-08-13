import React from 'react';
import { CONFIG, ACCENT, ACCENT_DARK, accentAlpha } from './config';
import { PALETTE, familyOf, PaletteFamily } from './palette';
import type { AuthUser, Curve, Dash, El, ElType, GalleryCard, Head, Library, LibItem, Point, Scene, SceneMeta, StyleDefaults, Tool, View } from './types';
import { cloudConfigured, decodeJwt, initGoogle, promptGoogle, renderGoogleButton, silentCredential } from './cloud/google';
import { CloudStore } from './cloud/s3';
import { Header } from './ui/Header';
import { ToolRail } from './ui/ToolRail';
import { CanvasOverlays } from './ui/CanvasOverlays';
import { SidePanel, SIDEBAR_W } from './ui/SidePanel';
import { Gallery } from './ui/Gallery';
import { FooterBar } from './ui/FooterBar';
import { Modals } from './ui/Modals';

export interface Editing { id: string; isLabel: boolean; value: string; }

export interface WBState {
  loading: boolean; dbError: string; tool: Tool; sel: string[]; rev: number;
  scenes: SceneMeta[]; sceneId: string; name: string; isSample: boolean;
  save: 'idle' | 'saving' | 'ok' | 'fail' | 'mem'; toast: string | null; toastKind: 'ok' | 'bad';
  help: boolean; editing: Editing | null;
  view: 'canvas' | 'gallery'; gallery: GalleryCard[]; q: string;
  nameError: string; live: string;
  embedOpen: boolean; embedUrl: string; mermaidOpen: boolean; libOpen: boolean; libs: Library[];
  picker: 'stroke' | 'fill' | null; hexDraft: string | null;
  auth: AuthUser | null;
  authOpen: boolean; authBusy: boolean; accountOpen: boolean; signOutAsk: boolean;
  autoSync: boolean; keepLocal: boolean; syncState: 'ok' | 'syncing';
  drawMode: 'free' | 'shape'; theme: 'light' | 'dark'; scenesOpen: boolean; menuOpen: boolean;
  sidebarOpen: boolean;
  mermaidSrc: string;
  style: StyleDefaults;
}

interface StoredAuth extends AuthUser {
  idToken?: string;
  tokenExp?: number;
  autoSync?: boolean;
  keepLocal?: boolean;
}

function readStoredAuth(): StoredAuth | null {
  try { return JSON.parse(localStorage.getItem('slate.auth') || 'null'); } catch { return null; }
}

function writeStoredAuth(patch: Partial<StoredAuth>): void {
  try {
    const cur = readStoredAuth() || {};
    localStorage.setItem('slate.auth', JSON.stringify(Object.assign(cur, patch)));
  } catch { /* storage blocked */ }
}

function readSidebarOpen(): boolean {
  try { return localStorage.getItem('slate.sidebar') !== 'closed'; } catch { return true; }
}

type Drag =
  | { mode: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { mode: 'laser' }
  | { mode: 'move'; start: Point; ids: string[]; orig: Record<string, { x: number; y: number }>; moved?: boolean }
  | { mode: 'create'; id: string; start: Point }
  | { mode: 'resize'; k: string; id: string; orig: El }
  | { mode: 'marquee'; a: Point; b: Point }
  | { mode: 'erase'; erased?: boolean }
  | { mode: 'draw'; id: string };

const boot0 = readStoredAuth();

export class Whiteboard extends React.Component<object, WBState> {
  state: WBState = {
    loading: true, dbError: '', tool: 'v', sel: [], rev: 0,
    scenes: [], sceneId: '', name: '', isSample: false,
    save: 'idle', toast: null, toastKind: 'ok', help: false, editing: null,
    view: 'canvas', gallery: [], q: '',
    nameError: '', live: '',
    embedOpen: false, embedUrl: '', mermaidOpen: false, libOpen: false, libs: [], picker: null, hexDraft: null,
    auth: boot0 && boot0.email ? { name: boot0.name, email: boot0.email, sub: boot0.sub, since: boot0.since } : null,
    authOpen: false, authBusy: false, accountOpen: false, signOutAsk: false,
    autoSync: boot0 && boot0.autoSync != null ? !!boot0.autoSync : true,
    keepLocal: boot0 && boot0.keepLocal != null ? !!boot0.keepLocal : true,
    syncState: 'ok',
    drawMode: 'free', theme: 'light', scenesOpen: true, menuOpen: false,
    sidebarOpen: readSidebarOpen(),
    mermaidSrc: 'graph TD\n  A[Start] --> B{Ready?}\n  B -->|yes| C[Ship it]\n  B -->|no| D(Fix it)\n  D --> B',
    style: { stroke: '#1e1e1e', fill: 'transparent', sw: 2, opacity: 1, fontSize: 20, dash: 'solid', rough: 0, curve: 'straight', head: 'arrow', tail: 'none' },
  };

  els: El[] = [];
  view: View = { x: -40, y: -30, z: 1 };
  hist: string[] = []; future: string[] = [];
  drag: Drag | null = null;
  db: IDBDatabase | null = null;
  mem = false;
  imgs: Record<string, HTMLImageElement & { __bad?: boolean }> = {};
  memStore: Record<string, Scene> = {};
  pool: El[] | null = null;

  cloud: CloudStore | null = null;
  cloudMetas: SceneMeta[] = [];
  sessionCache: Record<string, Scene> = {};
  memLibs: Library[] = [];

  canvas: HTMLCanvasElement | null = null;
  wrapEl: HTMLElement | null = null;
  editEl: HTMLTextAreaElement | null = null;
  embedLayer: HTMLElement | null = null;
  ro: ResizeObserver | null = null;
  space = false;
  touches = new Map<number, { x: number; y: number }>();
  pinch: { d: number; z: number; wx: number; wy: number } | null = null;
  laserTrail: { x: number; y: number; t: number }[] = [];
  laserRAF: number | null = null;
  exporting = false;
  inkCache: Record<string, string> | null = null;
  pasteBound = false;

  saveT: ReturnType<typeof setTimeout> | undefined;
  viewT: ReturnType<typeof setTimeout> | undefined;
  toastT: ReturnType<typeof setTimeout> | undefined;
  onKey: ((e: KeyboardEvent) => void) | null = null;
  onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  onPaste: ((e: ClipboardEvent) => void) | null = null;

  canvasRef = (n: HTMLCanvasElement | null) => { this.canvas = n instanceof Element ? n : null; if (this.canvas) this.bindCanvas(this.canvas); };
  wrapRef = (n: HTMLElement | null) => { this.wrapEl = n instanceof Element ? n : null; };
  editRef = (n: HTMLTextAreaElement | null) => {
    this.editEl = n instanceof Element ? n : null;
    if (this.editEl) setTimeout(() => { this.placeEditor(); this.editEl?.focus(); this.editEl?.select(); }, 0);
  };
  embedLayerRef = (n: HTMLElement | null) => { this.embedLayer = n instanceof Element ? n : null; };
  googleBtnRef = (n: HTMLElement | null) => {
    if (n && cloudConfigured()) {
      initGoogle(this.onGoogleCredential).then(() => { if (n.isConnected) renderGoogleButton(n); }).catch(() => { /* offline */ });
    }
  };

  /* ---------- lifecycle ---------- */

  componentDidMount() {
    let t: string | null = null;
    try { t = localStorage.getItem('slate.theme'); } catch { /* storage blocked */ }
    if (t !== 'dark' && t !== 'light') t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    if (t !== this.state.theme) this.setState({ theme: t as 'light' | 'dark' });
    this.onKey = this.handleKey.bind(this);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') this.space = false; });
    this.ro = new ResizeObserver(() => this.draw());
    this.boot();
    this.forceUpdate();
  }

  componentWillUnmount() {
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    if (this.onPaste) window.removeEventListener('paste', this.onPaste);
    if (this.ro) this.ro.disconnect();
    clearTimeout(this.saveT);
  }

  componentDidUpdate() { this.draw(); this.placeEditor(); }

  bindCanvas(c: HTMLCanvasElement & { __bound?: boolean }) {
    if (c.__bound) return;
    c.__bound = true;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', (e) => this.up(e));
    c.addEventListener('dblclick', (e) => this.dbl(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    c.addEventListener('dragover', (e) => { e.preventDefault(); });
    c.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (/\.excalidrawlib$/i.test(f.name)) {
        const r = new FileReader();
        r.onload = () => this.installLibrary(String(r.result), f.name.replace(/\.excalidrawlib$/i, '').slice(0, 60) || 'Library');
        r.readAsText(f);
        return;
      }
      this.addImage(f, this.s2w(e));
    });
    if (!this.pasteBound) {
      this.pasteBound = true;
      window.addEventListener('paste', this.onPaste = (e: ClipboardEvent) => {
        if (this.state.editing) return;
        const items = (e.clipboardData && e.clipboardData.items) || ([] as unknown as DataTransferItemList);
        for (let i = 0; i < items.length; i++) {
          if (items[i].type && items[i].type.indexOf('image/') === 0) {
            const f = items[i].getAsFile();
            if (f) { e.preventDefault(); this.addImage(f); }
            return;
          }
        }
      });
    }
    if (this.ro && this.wrapEl instanceof Element) this.ro.observe(this.wrapEl);
    this.draw();
  }

  /* ---------- storage (IndexedDB) ---------- */

  openDb(): Promise<IDBDatabase> {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('This browser has no IndexedDB.'));
      let req: IDBOpenDBRequest;
      try { req = indexedDB.open('slate-whiteboard', 1); } catch (err) { return rej(err); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('scenes')) db.createObjectStore('scenes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error || new Error('IndexedDB was blocked.'));
      req.onblocked = () => rej(new Error('Another tab is upgrading the database.'));
    });
  }

  tx<T = unknown>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
    return new Promise((res, rej) => {
      if (!this.db) return rej(new Error('no db'));
      const t = this.db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && (r as IDBRequest).result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('transaction aborted'));
    });
  }

  async boot() {
    let scenes: Scene[] = [], lastId = '';
    try {
      this.db = await this.openDb();
      scenes = await this.readAll();
      const meta = await this.tx<{ k: string; v: string } | undefined>('meta', 'readonly', (s) => s.get('last'));
      lastId = (meta && meta.v) || '';
    } catch (err: any) {
      this.mem = true;
      this.setState({ dbError: this.clean(err && err.message) || 'Local storage is unavailable.' });
    }
    if (!scenes.length) {
      const s = this.sampleScene();
      scenes = [s];
      lastId = s.id;
      await this.persist(s);
      await this.setLast(s.id);
    }
    scenes.sort((a, b) => b.updatedAt - a.updatedAt);
    const open = scenes.find((s) => s.id === lastId) || scenes[0];
    this.els = this.migrate(open.elements);
    this.view = Object.assign({ x: -40, y: -30, z: 1 }, open.view || {});
    this.hist = []; this.future = [];
    this.setState({
      loading: false, scenes: scenes.map(this.strip), sceneId: open.id,
      name: open.name, isSample: !!open.isSample, sel: [], rev: this.state.rev + 1,
    }, () => { this.draw(); if (this.els.length) requestAnimationFrame(() => this.fit()); });
    this.loadLibs();
    this.reconnect();
  }

  strip = (s: Scene | SceneMeta & { elements?: El[] }): SceneMeta =>
    ({ id: s.id, name: s.name, updatedAt: s.updatedAt, count: ((s as Scene).elements || []).length, isSample: !!s.isSample });

  clean(msg: unknown) { return msg ? String(msg).slice(0, 120) : ''; }

  async persist(scene: Scene) {
    if (!scene.id) return;
    if (this.state.auth && !this.state.keepLocal) { this.sessionCache[scene.id] = JSON.parse(JSON.stringify(scene)); return; }
    if (this.mem || !this.db) { this.memStore[scene.id] = JSON.parse(JSON.stringify(scene)); return; }
    try { await this.tx('scenes', 'readwrite', (s) => s.put(scene)); } catch (err) { this.setState({ save: 'fail' }); throw err; }
  }

  async persistLocal(scene: Scene) {
    if (this.mem || !this.db) { this.memStore[scene.id] = JSON.parse(JSON.stringify(scene)); return; }
    try { await this.tx('scenes', 'readwrite', (s) => s.put(scene)); } catch { /* non-fatal */ }
  }

  async readScene(id: string): Promise<Scene | null> {
    if (this.sessionCache[id]) return this.sessionCache[id];
    if (this.db && !this.mem) {
      try { const s = await this.tx<Scene | undefined>('scenes', 'readonly', (st) => st.get(id)); if (s) return s; } catch { /* fall through */ }
    }
    if (this.memStore[id]) return this.memStore[id];
    if (this.state.auth && cloudConfigured()) {
      try {
        const cloud = await this.ensureCloud();
        const s = await cloud.getScene(id);
        if (s) {
          if (this.state.keepLocal) await this.persistLocal(s);
          else this.sessionCache[id] = s;
          return s;
        }
      } catch { /* offline */ }
    }
    return null;
  }

  async readAll(): Promise<Scene[]> {
    let out: Scene[] = [];
    if (this.db && !this.mem) {
      try { out = (await this.tx<Scene[]>('scenes', 'readonly', (s) => s.getAll())) || []; } catch { /* fall through */ }
    }
    if (!out.length) out = Object.keys(this.memStore).map((k) => this.memStore[k]);
    const ids = new Set(out.map((s) => s.id));
    for (const k of Object.keys(this.sessionCache)) if (!ids.has(k)) out.push(this.sessionCache[k]);
    return out;
  }

  async setLast(id: string) {
    if (this.mem || !this.db) return;
    try { await this.tx('meta', 'readwrite', (s) => s.put({ k: 'last', v: id })); } catch { /* non-fatal */ }
  }

  currentScene(): Scene {
    const meta = this.state.scenes.find((s) => s.id === this.state.sceneId);
    return {
      id: this.state.sceneId, name: this.state.name || 'Untitled scene',
      elements: this.els, view: this.view, updatedAt: Date.now(), isSample: !!(meta && meta.isSample),
    };
  }

  queueSave() {
    clearTimeout(this.saveT);
    if (this.mem) { this.setState({ save: 'mem' }); return; }
    this.setState({ save: 'saving' });
    this.saveT = setTimeout(async () => {
      const scene = this.currentScene();
      try {
        await this.persist(scene);
        if (this.state.auth && this.state.autoSync) await this.syncScene(scene);
        this.setState((s) => ({
          save: 'ok',
          scenes: s.scenes.map((x) => (x.id === scene.id ? Object.assign({}, x, { updatedAt: scene.updatedAt, count: scene.elements.length, name: scene.name }) : x)),
        }));
      } catch {
        this.setState({ save: 'fail' });
        this.toast('Autosave failed — export a .json copy so you do not lose this.', 'bad');
      }
    }, 500);
  }

  /* ---------- account (Google sign-in + S3 sync) ---------- */

  async ensureCloud(): Promise<CloudStore> {
    if (!cloudConfigured()) throw new Error('Cloud sync is not configured.');
    await initGoogle(this.onGoogleCredential);
    const stored = readStoredAuth();
    let token = stored && stored.idToken;
    const fresh = token && stored && Date.now() < (stored.tokenExp || 0) - 60_000;
    if (this.cloud && !this.cloud.expired && fresh) return this.cloud;
    if (!fresh) {
      token = await silentCredential();
      const claims = decodeJwt(token);
      writeStoredAuth({ idToken: token, tokenExp: claims.exp * 1000 });
    }
    if (!this.cloud) this.cloud = new CloudStore(token!);
    else this.cloud.setToken(token!);
    await this.cloud.init();
    return this.cloud;
  }

  onGoogleCredential = async (credential: string) => {
    const claims = decodeJwt(credential);
    writeStoredAuth({ idToken: credential, tokenExp: claims.exp * 1000 });
    const existing = this.state.auth;
    if (existing && existing.sub === claims.sub) { if (this.cloud) this.cloud.setToken(credential); return; }
    this.setState({ authBusy: true });
    try {
      this.cloud = new CloudStore(credential);
      await this.cloud.init();
    } catch {
      this.cloud = null;
      this.setState({ authBusy: false });
      this.toast('Sign-in failed — could not reach cloud storage.', 'bad');
      return;
    }
    const auth: AuthUser = { name: claims.name, email: claims.email, sub: claims.sub, since: Date.now() };
    writeStoredAuth({ ...auth, autoSync: this.state.autoSync, keepLocal: this.state.keepLocal });
    const n = this.state.scenes.length;
    this.setState({ auth, authBusy: false, authOpen: false, syncState: 'syncing' });
    this.toast(n ? 'Signed in. ' + n + (n === 1 ? ' scene' : ' scenes') + ' uploading to your gallery.' : 'Signed in as ' + auth.email + '.');
    try { await this.initialSync(); } catch { /* keep local copies */ }
    this.setState({ syncState: 'ok' });
  };

  async initialSync() {
    if (!this.cloud) return;
    const locals = await this.readAll();
    let remote: SceneMeta[] = [];
    try { remote = await this.cloud.getMeta(); } catch { /* first sign-in */ }
    const byId = new Map(remote.map((m) => [m.id, m] as const));
    for (const s of locals) {
      const r = byId.get(s.id);
      if (!r || (s.updatedAt || 0) >= (r.updatedAt || 0)) {
        await this.cloud.putScene(s);
        byId.set(s.id, this.strip(s));
      }
    }
    for (const m of remote) {
      if (locals.some((l) => l.id === m.id)) continue;
      try {
        const sc = await this.cloud.getScene(m.id);
        if (sc) { if (this.state.keepLocal) await this.persistLocal(sc); else this.sessionCache[sc.id] = sc; }
      } catch { /* skip */ }
    }
    this.cloudMetas = [...byId.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    await this.cloud.putMeta(this.cloudMetas);
    this.setState({ scenes: this.cloudMetas.slice() });
  }

  async reconnect() {
    if (!this.state.auth || !cloudConfigured()) return;
    this.setState({ syncState: 'syncing' });
    try {
      const cloud = await this.ensureCloud();
      const remote = await cloud.getMeta();
      this.cloudMetas = remote;
      this.setState((s) => {
        const map = new Map(s.scenes.map((m) => [m.id, m] as const));
        for (const m of remote) { const l = map.get(m.id); if (!l || (m.updatedAt || 0) > (l.updatedAt || 0)) map.set(m.id, m); }
        return { scenes: [...map.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) };
      });
    } catch { /* offline — local copies still open */ }
    this.setState({ syncState: 'ok' });
  }

  async syncScene(scene: Scene) {
    if (!scene.id || !scene.elements) return;
    const cloud = await this.ensureCloud();
    await cloud.putScene(scene);
    const meta = this.strip(scene);
    const rest = this.cloudMetas.filter((m) => m.id !== scene.id);
    this.cloudMetas = [meta].concat(rest).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    await cloud.putMeta(this.cloudMetas);
  }

  /** Upload-on-close when "Sync as I draw" is off. */
  closeSync(scene: Scene) {
    if (this.state.auth && !this.state.autoSync) {
      this.setState({ syncState: 'syncing' });
      this.syncScene(scene)
        .catch(() => { /* stays cached locally */ })
        .then(() => this.setState({ syncState: 'ok' }));
    }
  }

  googleClick = () => {
    if (!cloudConfigured()) { this.toast('Sign-in is not configured for this build — see the README.', 'bad'); return; }
    initGoogle(this.onGoogleCredential).then(() => promptGoogle()).catch(() => this.toast('Sign-in failed — could not reach Google.', 'bad'));
  };

  async signOut() {
    try { localStorage.removeItem('slate.auth'); } catch { /* storage blocked */ }
    this.cloud = null;
    this.cloudMetas = [];
    try {
      if (this.db) {
        await this.tx('scenes', 'readwrite', (s) => s.clear());
        await this.tx('meta', 'readwrite', (s) => s.delete('last'));
      }
    } catch { /* ignore */ }
    this.memStore = {}; this.sessionCache = {}; this.imgs = {};
    this.els = []; this.hist = []; this.future = [];
    this.setState({ auth: null, accountOpen: false, signOutAsk: false, syncState: 'ok', scenes: [], gallery: [], sceneId: '', sel: [], editing: null });
    await this.newScene([], 'Untitled scene');
    this.toast('Signed out. This browser is back to local-only storage.');
  }
  /* ---------- gallery ---------- */

  async openGallery() {
    this.setState({ view: 'gallery' });
    clearTimeout(this.saveT);
    const cur = this.currentScene();
    await this.persist(cur).catch(() => { /* ignore */ });
    this.closeSync(cur);
    const all = await this.readAll().catch(() => [] as Scene[]);
    if (this.state.auth && cloudConfigured()) {
      try {
        const cloud = await this.ensureCloud();
        const remote = await cloud.getMeta();
        this.cloudMetas = remote;
        const have = new Set(all.map((s) => s.id));
        for (const m of remote) {
          if (have.has(m.id)) continue;
          const sc = await this.readScene(m.id);
          if (sc) all.push(sc);
        }
      } catch { /* offline — show cached copies */ }
    }
    const cards: GalleryCard[] = all.slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((s) => ({
        id: s.id, name: s.name || 'Untitled scene', count: (s.elements || []).length,
        updatedAt: s.updatedAt || 0, isSample: !!s.isSample, thumb: this.thumbFor(s),
      }));
    this.setState({ gallery: cards, scenes: cards.map((c) => ({ id: c.id, name: c.name, updatedAt: c.updatedAt, count: c.count, isSample: c.isSample })) });
  }

  thumbFor(scene: Scene): string {
    const els = this.migrate(scene.elements || []);
    if (!els.length) return '';
    this.exporting = true;
    try {
      const W = 460, H = 290, pad = 16, scale = 2;
      const b = this.bbox(els);
      const z = Math.min((W - pad * 2) / (b.w || 1), (H - pad * 2) / (b.h || 1), 1.6);
      const c = document.createElement('canvas');
      c.width = W * scale; c.height = H * scale;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
      const ox = (W - b.w * z) / 2 - b.x * z, oy = (H - b.h * z) / 2 - b.y * z;
      ctx.setTransform(z * scale, 0, 0, z * scale, ox * scale, oy * scale);
      this.paint(ctx, els);
      this.exporting = false;
      return c.toDataURL('image/png');
    } catch { this.exporting = false; return ''; }
  }

  async exportSceneJson(id: string) {
    const scene = id === this.state.sceneId ? this.currentScene() : await this.readScene(id);
    if (!scene) return this.toast('That scene could not be read from local storage.', 'bad');
    const data = { type: 'slate-scene', version: 1, name: scene.name || 'Untitled scene', elements: scene.elements || [] };
    const fname = String(scene.name || 'scene').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 40) + '.json';
    this.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), fname || 'scene.json');
    this.toast('Exported ' + fname + '.');
  }

  /* ---------- scenes ---------- */

  async loadScene(id: string) {
    if (id === this.state.sceneId) { this.setState({ view: 'canvas' }); return; }
    clearTimeout(this.saveT);
    const cur = this.currentScene();
    await this.persist(cur).catch(() => { /* ignore */ });
    this.closeSync(cur);
    const scene = await this.readScene(id);
    if (!scene) { this.toast('That scene could not be read from local storage.', 'bad'); return; }
    this.imgs = {};
    this.els = this.migrate(scene.elements);
    this.view = Object.assign({ x: -40, y: -30, z: 1 }, scene.view || {});
    this.hist = []; this.future = [];
    this.setLast(id);
    this.setState({ sceneId: id, name: scene.name, isSample: !!scene.isSample, sel: [], editing: null, save: this.mem ? 'mem' : 'ok', live: 'Opened ' + scene.name, view: 'canvas' }, () => this.draw());
  }

  async newScene(elements: El[], name?: string): Promise<Scene> {
    clearTimeout(this.saveT);
    const cur = this.currentScene();
    await this.persist(cur).catch(() => { /* ignore */ });
    this.closeSync(cur);
    const scene: Scene = { id: this.uid(), name: name || 'Untitled scene', elements: elements || [], view: { x: -40, y: -30, z: 1 }, updatedAt: Date.now(), isSample: false };
    await this.persist(scene).catch(() => { /* ignore */ });
    this.setLast(scene.id);
    this.els = scene.elements;
    this.view = Object.assign({}, scene.view);
    this.hist = []; this.future = [];
    this.setState((s) => ({ scenes: [this.strip(scene)].concat(s.scenes), sceneId: scene.id, name: scene.name, isSample: false, sel: [], editing: null, view: 'canvas' }), () => this.draw());
    return scene;
  }

  async dupScene(id: string) {
    let src: Scene | null = this.state.sceneId === id ? this.currentScene() : null;
    if (!src) src = await this.readScene(id);
    if (!src) return this.toast('Could not duplicate that scene.', 'bad');
    await this.newScene(JSON.parse(JSON.stringify(src.elements)), src.name + ' copy');
    this.toast('Duplicated “' + src.name + '”.');
  }

  async delScene(id: string) {
    const meta = this.state.scenes.find((s) => s.id === id);
    if (!meta) return;
    if (meta.count > 0 && !window.confirm('Delete “' + meta.name + '” and its ' + meta.count + ' element' + (meta.count === 1 ? '' : 's') + '? This cannot be undone.')) return;
    try { if (this.db) await this.tx('scenes', 'readwrite', (s) => s.delete(id)); } catch { /* ignore */ }
    delete this.memStore[id];
    delete this.sessionCache[id];
    if (this.state.auth && cloudConfigured()) {
      this.cloudMetas = this.cloudMetas.filter((m) => m.id !== id);
      const metas = this.cloudMetas;
      this.ensureCloud().then((cloud) => Promise.all([cloud.deleteScene(id), cloud.putMeta(metas)])).catch(() => { /* offline */ });
    }
    const rest = this.state.scenes.filter((s) => s.id !== id);
    this.setState((st) => ({ scenes: rest, gallery: st.gallery.filter((g) => g.id !== id) }));
    if (id === this.state.sceneId) {
      if (rest.length) { this.setState({ sceneId: '' }, () => this.loadScene(rest[0].id)); }
      else { await this.newScene([], 'Untitled scene'); }
    }
    this.toast('Deleted “' + meta.name + '”.');
  }

  /* ---------- model helpers ---------- */

  uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

  migrate(list: unknown): El[] {
    if (!Array.isArray(list)) return [];
    const out: El[] = list.filter((e) => e && typeof e === 'object' && this.validEl(e)).map((e) => Object.assign({
      id: e.id || this.uid(), opacity: 1, sw: 2, stroke: '#1e1e1e', fill: 'transparent', fontSize: 20, label: '', dash: 'solid', rough: 0, curve: 'straight',
    }, e)).map((e: El) => {
      if (['solid', 'dashed', 'dotted'].indexOf(e.dash) < 0) e.dash = 'solid';
      e.rough = Number.isFinite(Number(e.rough)) ? Math.max(0, Math.min(2, Number(e.rough))) : 0;
      if (['straight', 'curved', 'elbow'].indexOf(e.curve) < 0) e.curve = 'straight';
      const heads = ['none', 'arrow', 'triangle', 'dot', 'bar'];
      if (e.head != null && heads.indexOf(e.head) < 0) e.head = e.type === 'arrow' ? 'arrow' : 'none';
      if (e.tail != null && heads.indexOf(e.tail) < 0) e.tail = 'none';
      return e;
    });
    const ids = new Set(out.map((e) => e.id));
    return out.filter((e) => {
      if (e.type !== 'arrow' && e.type !== 'line') return true;
      if (e.startBinding && !ids.has(e.startBinding)) e.startBinding = null;
      if (e.endBinding && !ids.has(e.endBinding)) e.endBinding = null;
      // a connector needs either both ends bound, or real geometry for its free end
      if (e.startBinding && e.endBinding) return true;
      return Math.hypot(e.w || 0, e.h || 0) >= 4;
    });
  }

  validEl(e: any): boolean {
    const types = ['rect', 'ellipse', 'diamond', 'triangle', 'line', 'arrow', 'draw', 'text', 'sticky', 'frame', 'image', 'embed'];
    if (types.indexOf(e.type) < 0) return false;
    const n = (v: unknown) => typeof v === 'number' && isFinite(v);
    if (!n(e.x) || !n(e.y)) return false;
    if (e.type === 'draw') return Array.isArray(e.points) && e.points.length > 1;
    if (e.type === 'text') return typeof e.text === 'string';
    if (e.type === 'image') return typeof e.src === 'string' && e.src.slice(0, 11) === 'data:image/' && n(e.w) && n(e.h);
    if (e.type === 'embed') return typeof e.src === 'string' && /^https:\/\//.test(e.src) && e.src.length < 2048 && n(e.w) && n(e.h);
    return n(e.w) && n(e.h);
  }

  byId(id: string | null | undefined): El | undefined { return (this.pool || this.els).find((e) => e.id === id); }

  withFrameChildren(ids: string[]): string[] {
    const out = ids.slice();
    for (const id of ids) {
      const f = this.byId(id);
      if (!f || f.type !== 'frame') continue;
      const b = this.box(f);
      for (const el of this.els) {
        if (el.id === f.id || out.indexOf(el.id) >= 0) continue;
        const eb = this.bbox([el]), cx = eb.x + eb.w / 2, cy = eb.y + eb.h / 2;
        if (cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.h) out.push(el.id);
      }
    }
    return out;
  }

  imgFor(el: El): (HTMLImageElement & { __bad?: boolean }) | null {
    if (!el.src) return null;
    let im = this.imgs[el.id];
    if (!im) {
      im = new Image();
      im.onload = () => this.draw();
      im.onerror = () => { im.__bad = true; this.draw(); };
      im.src = el.src;
      this.imgs[el.id] = im;
    }
    return im;
  }

  pickImage() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => this.addImage(inp.files && inp.files[0]);
    inp.click();
  }

  addImage(file: File | null, at?: Point) {
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0) return this.toast('That file is not an image.', 'bad');
    if (file.size > 1.5 * 1024 * 1024) return this.toast('Images must be under 1.5 MB — they are stored inside your browser, not on a server.', 'bad');
    const r = new FileReader();
    r.onerror = () => this.toast('Could not read that image.', 'bad');
    r.onload = () => {
      const src = String(r.result);
      if (src.slice(0, 11) !== 'data:image/') return this.toast('That image could not be decoded.', 'bad');
      const probe = new Image();
      probe.onerror = () => this.toast('That image could not be decoded.', 'bad');
      probe.onload = () => {
        const sc = Math.min(1, 360 / Math.max(probe.naturalWidth, probe.naturalHeight));
        const w = Math.max(20, Math.round(probe.naturalWidth * sc)), h = Math.max(20, Math.round(probe.naturalHeight * sc));
        let cx = 0, cy = 0;
        if (at) { cx = at.x; cy = at.y; }
        else if (this.canvas) { cx = this.canvas.clientWidth / 2 / this.view.z + this.view.x; cy = this.canvas.clientHeight / 2 / this.view.z + this.view.y; }
        this.push();
        const el: El = { id: this.uid(), type: 'image', x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, src, name: String(file.name || 'image').slice(0, 60), stroke: '#1e1e1e', fill: 'transparent', sw: 2, opacity: 1, fontSize: 16, label: '', dash: 'solid', rough: 0, curve: 'straight' };
        this.els.push(el);
        this.setState((s) => ({ sel: [el.id], rev: s.rev + 1, tool: 'v' }));
        this.queueSave();
        this.toast('Placed ' + el.name + ' — embedded in this scene, stored only in this browser.');
      };
      probe.src = src;
    };
    r.readAsDataURL(file);
  }

  box(el: El): { x: number; y: number; w: number; h: number } {
    if (el.type === 'text') return { x: el.x, y: el.y, w: el.w || 10, h: el.h || (el.fontSize * 1.25) };
    const x = Math.min(el.x, el.x + el.w), y = Math.min(el.y, el.y + el.h);
    return { x, y, w: Math.abs(el.w), h: Math.abs(el.h) };
  }

  bbox(list: El[]): { x: number; y: number; w: number; h: number } {
    if (!list.length) return { x: 0, y: 0, w: 0, h: 0 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of list) {
      let b;
      if (el.type === 'line' || el.type === 'arrow') {
        const p = this.linePts(el), xs = p.map((q) => q.x), ys = p.map((q) => q.y);
        const mnx = Math.min.apply(null, xs), mny = Math.min.apply(null, ys);
        b = { x: mnx, y: mny, w: Math.max.apply(null, xs) - mnx, h: Math.max.apply(null, ys) - mny };
      }
      else b = this.box(el);
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  edgePt(el: El, toward: Point, gap?: number): Point {
    const b = this.box(el), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let dx = toward.x - cx, dy = toward.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const hw = b.w / 2, hh = b.h / 2;
    let t;
    if (el.type === 'ellipse') t = 1 / Math.hypot(dx / (hw || 1), dy / (hh || 1));
    else if (el.type === 'diamond') t = 1 / (Math.abs(dx) / (hw || 1) + Math.abs(dy) / (hh || 1));
    else t = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
    t += gap || 0;
    return { x: cx + dx * t, y: cy + dy * t };
  }

  pts(el: El): [Point, Point] {
    let a: Point = { x: el.x, y: el.y }, b: Point = { x: el.x + el.w, y: el.y + el.h };
    const s = el.startBinding ? this.byId(el.startBinding) : undefined;
    const e = el.endBinding ? this.byId(el.endBinding) : undefined;
    if (s) { const bb = this.box(s); a = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 }; }
    if (e) { const bb = this.box(e); b = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 }; }
    if (s) a = this.edgePt(s, b, 5);
    if (e) b = this.edgePt(e, a, 5);
    return [a, b];
  }

  /* Full polyline for a connector, honouring straight / curved / elbow routing. */
  linePts(el: El): Point[] {
    const p = this.pts(el), a = p[0], b = p[1];
    const kind = el.curve || 'straight';
    if (kind === 'elbow') {
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      if (dx >= dy) { const mx = (a.x + b.x) / 2; return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]; }
      const my = (a.y + b.y) / 2;
      return [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
    }
    if (kind === 'curved') {
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const off = Math.min(70, len * 0.22);
      const cx = (a.x + b.x) / 2 - (dy / len) * off, cy = (a.y + b.y) / 2 + (dx / len) * off;
      const out: Point[] = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18, u = 1 - t;
        out.push({ x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y });
      }
      return out;
    }
    return [a, b];
  }

  /* One arrowhead at `tip`, pointing along `ang`. */
  head(ctx: CanvasRenderingContext2D, kind: Head | undefined, tip: Point, ang: number, sw: number, colour: string) {
    if (!kind || kind === 'none') return;
    const L = 10 + sw * 1.6;
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = colour; ctx.fillStyle = colour;
    ctx.lineWidth = sw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (kind === 'dot') {
      ctx.beginPath(); ctx.arc(tip.x, tip.y, Math.max(3, sw * 1.6), 0, 6.2832); ctx.fill();
    } else if (kind === 'bar') {
      const px = Math.cos(ang + Math.PI / 2) * (L * 0.5), py = Math.sin(ang + Math.PI / 2) * (L * 0.5);
      ctx.beginPath(); ctx.moveTo(tip.x - px, tip.y - py); ctx.lineTo(tip.x + px, tip.y + py); ctx.stroke();
    } else {
      const a1 = { x: tip.x - L * Math.cos(ang - 0.42), y: tip.y - L * Math.sin(ang - 0.42) };
      const a2 = { x: tip.x - L * Math.cos(ang + 0.42), y: tip.y - L * Math.sin(ang + 0.42) };
      ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(a2.x, a2.y);
      if (kind === 'triangle') { ctx.closePath(); ctx.fill(); } else ctx.stroke();
    }
    ctx.restore();
  }

  distSeg(x: number, y: number, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
  }

  hitEl(el: El, x: number, y: number): boolean {
    const t = 8 / this.view.z;
    if (el.type === 'line' || el.type === 'arrow') {
      const p = this.linePts(el);
      for (let i = 1; i < p.length; i++) if (this.distSeg(x, y, p[i - 1], p[i]) <= t) return true;
      return false;
    }
    if (el.type === 'draw') {
      const pts = el.points!;
      for (let i = 1; i < pts.length; i++) {
        const a = { x: el.x + pts[i - 1][0], y: el.y + pts[i - 1][1] };
        const b = { x: el.x + pts[i][0], y: el.y + pts[i][1] };
        if (this.distSeg(x, y, a, b) <= t) return true;
      }
      return false;
    }
    const b = this.box(el);
    if (x < b.x - t || x > b.x + b.w + t || y < b.y - t || y > b.y + b.h + t) return false;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (el.type === 'ellipse') { const u = (x - cx) / (b.w / 2 + t), v = (y - cy) / (b.h / 2 + t); return u * u + v * v <= 1; }
    if (el.type === 'diamond') return Math.abs(x - cx) / (b.w / 2 + t) + Math.abs(y - cy) / (b.h / 2 + t) <= 1;
    if (el.type === 'triangle') {
      const p = this.triPts(el);
      let inside = false;
      for (let i = 0, j = 2; i < 3; j = i++) {
        if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / ((p[j][1] - p[i][1]) || 1e-6) + p[i][0]) inside = !inside;
      }
      if (inside) return true;
      for (let i = 0, j = 2; i < 3; j = i++) if (this.distSeg(x, y, { x: p[j][0], y: p[j][1] }, { x: p[i][0], y: p[i][1] }) <= t) return true;
      return false;
    }
    return true;
  }

  hit(x: number, y: number): El | null { for (let i = this.els.length - 1; i >= 0; i--) if (this.hitEl(this.els[i], x, y)) return this.els[i]; return null; }

  hitShape(x: number, y: number): El | null { for (let i = this.els.length - 1; i >= 0; i--) { const e = this.els[i]; if (['rect', 'ellipse', 'diamond', 'triangle'].indexOf(e.type) >= 0 && this.hitEl(e, x, y)) return e; } return null; }

  handles(el: El): { k: string; x: number; y: number }[] {
    if (el.type === 'line' || el.type === 'arrow') { const p = this.pts(el); return [{ k: 'p0', x: p[0].x, y: p[0].y }, { k: 'p1', x: p[1].x, y: p[1].y }]; }
    const b = this.box(el), mx = b.x + b.w / 2, my = b.y + b.h / 2;
    return [
      { k: 'nw', x: b.x, y: b.y }, { k: 'n', x: mx, y: b.y }, { k: 'ne', x: b.x + b.w, y: b.y },
      { k: 'e', x: b.x + b.w, y: my }, { k: 'se', x: b.x + b.w, y: b.y + b.h }, { k: 's', x: mx, y: b.y + b.h },
      { k: 'sw', x: b.x, y: b.y + b.h }, { k: 'w', x: b.x, y: my },
    ];
  }

  push() {
    this.hist.push(JSON.stringify(this.els));
    if (this.hist.length > 80) this.hist.shift();
    this.future.length = 0;
  }

  undo() {
    if (!this.hist.length) return this.toast('Nothing to undo.');
    this.future.push(JSON.stringify(this.els));
    this.els = JSON.parse(this.hist.pop()!);
    const ids = this.els.map((e) => e.id);
    this.setState((s) => ({ sel: s.sel.filter((i) => ids.indexOf(i) >= 0), rev: s.rev + 1, live: 'Undo' }));
    this.queueSave();
  }

  redo() {
    if (!this.future.length) return this.toast('Nothing to redo.');
    this.hist.push(JSON.stringify(this.els));
    this.els = JSON.parse(this.future.pop()!);
    this.setState((s) => ({ rev: s.rev + 1, live: 'Redo' }));
    this.queueSave();
  }
  /* ---------- pointer ---------- */

  s2w(e: { clientX: number; clientY: number }): Point {
    const r = this.canvas!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.view.z + this.view.x, y: (e.clientY - r.top) / this.view.z + this.view.y };
  }

  snap(v: number): number { return CONFIG.snapToGrid ? Math.round(v / 10) * 10 : v; }

  gestureMid() {
    const t = [...this.touches.values()];
    const r = this.canvas!.getBoundingClientRect();
    return {
      x: (t[0].x + t[1].x) / 2 - r.left,
      y: (t[0].y + t[1].y) / 2 - r.top,
      d: Math.max(1, Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y)),
    };
  }

  startPinch() {
    const g = this.gestureMid();
    this.pinch = { d: g.d, z: this.view.z, wx: g.x / this.view.z + this.view.x, wy: g.y / this.view.z + this.view.y };
    if (this.drag && this.drag.mode === 'create') { const id = this.drag.id; this.els = this.els.filter((x) => x.id !== id); this.hist.pop(); }
    this.drag = null;
    this.setState({ sel: [] });
  }

  movePinch() {
    const g = this.gestureMid();
    const z = Math.max(0.2, Math.min(4, this.pinch!.z * (g.d / this.pinch!.d)));
    this.view.z = z;
    this.view.x = this.pinch!.wx - g.x / z;
    this.view.y = this.pinch!.wy - g.y / z;
    this.draw();
    clearTimeout(this.viewT);
    this.viewT = setTimeout(() => { this.setState((s) => ({ rev: s.rev + 1 })); this.queueSave(); }, 180);
  }

  down(e: PointerEvent) {
    if (e.button === 1) e.preventDefault();
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) { this.startPinch(); return; }
      if (this.touches.size > 2) return;
    }
    this.canvas!.focus();
    if (this.state.editing) this.commitEdit();
    this.canvas!.setPointerCapture?.(e.pointerId);
    const p = this.s2w(e);
    const tool = this.state.tool;
    if (tool === 'h' || this.space || e.button === 1) { this.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y }; return; }
    if (tool === 'k') {
      this.laserTrail = [{ x: p.x, y: p.y, t: performance.now() }];
      this.drag = { mode: 'laser' };
      this.laserTick();
      return;
    }
    if (tool === 'b') {
      const hit = this.hit(p.x, p.y);
      if (!hit) return this.toast('Click a shape to fill it.', 'bad');
      if (this.caps(hit.type).indexOf('fill') < 0) return this.toast(hit.type + ' has no fill.', 'bad');
      this.push();
      hit.fill = this.state.style.fill === 'transparent' ? '#a5d8ff' : this.state.style.fill;
      this.setState((s) => ({ sel: [hit.id], rev: s.rev + 1, tool: CONFIG.stickyTools ? s.tool : 'v' }));
      this.queueSave();
      return;
    }
    if (tool === 'v') {
      const sel = this.state.sel;
      if (sel.length === 1) {
        const el = this.byId(sel[0]);
        if (el) {
          const hs = this.handles(el), r = 7 / this.view.z;
          for (const h of hs) if (Math.abs(p.x - h.x) <= r && Math.abs(p.y - h.y) <= r) {
            this.push();
            this.drag = { mode: 'resize', k: h.k, id: el.id, orig: JSON.parse(JSON.stringify(el)) };
            return;
          }
        }
      }
      const hit = this.hit(p.x, p.y);
      if (hit) {
        let next = sel;
        if (e.shiftKey) next = sel.indexOf(hit.id) >= 0 ? sel.filter((i) => i !== hit.id) : sel.concat([hit.id]);
        else if (sel.indexOf(hit.id) < 0) next = [hit.id];
        this.push();
        const moveIds = this.withFrameChildren(next);
        this.drag = { mode: 'move', start: p, ids: moveIds, orig: {} };
        for (const id of moveIds) { const el = this.byId(id); if (el) this.drag.orig[id] = { x: el.x, y: el.y }; }
        this.setState({ sel: next, live: next.length + ' selected' });
        return;
      }
      this.drag = { mode: 'marquee', a: p, b: p };
      if (!e.shiftKey) this.setState({ sel: [] });
      return;
    }
    // creation tools
    this.push();
    const st = this.state.style;
    const base = { id: this.uid(), stroke: st.stroke, fill: st.fill, sw: st.sw, opacity: st.opacity, fontSize: st.fontSize, label: '', dash: st.dash || 'solid', rough: st.rough || 0, curve: st.curve || 'straight', head: st.head == null ? 'arrow' : st.head, tail: st.tail || 'none' } as El;
    if (tool === 'p') {
      const el = Object.assign(base, { type: 'draw' as ElType, x: p.x, y: p.y, w: 0, h: 0, points: [[0, 0]] as [number, number][] });
      this.els.push(el);
      this.drag = { mode: 'draw', id: el.id };
      this.setState({ sel: [el.id] });
      return;
    }
    if (tool === 't') {
      const el = Object.assign(base, { type: 'text' as ElType, x: this.snap(p.x), y: this.snap(p.y), text: '', w: 0, h: st.fontSize * 1.25 });
      this.els.push(el);
      this.drag = null;
      this.setState({ sel: [el.id], tool: 'v' }, () => this.startEdit(el.id, false));
      return;
    }
    if (tool === 'e') {
      this.drag = { mode: 'erase' };
      this.eraseAt(p);
      return;
    }
    if (tool === 's') {
      const el = Object.assign(base, { type: 'sticky' as ElType, x: this.snap(p.x), y: this.snap(p.y), w: 0, h: 0, fill: base.fill === 'transparent' ? '#FFF3C0' : base.fill, fontSize: 14, label: '' });
      this.els.push(el);
      this.drag = { mode: 'create', id: el.id, start: p };
      this.setState({ sel: [el.id] });
      return;
    }
    if (tool === 'f') {
      const el = Object.assign(base, { type: 'frame' as ElType, x: this.snap(p.x), y: this.snap(p.y), w: 0, h: 0, stroke: '#9A9A9A', fill: 'transparent', dash: 'dashed' as Dash, rough: 0, name: 'Frame ' + (this.els.filter((x) => x.type === 'frame').length + 1) });
      this.els.push(el);
      this.drag = { mode: 'create', id: el.id, start: p };
      this.setState({ sel: [el.id] });
      return;
    }
    const type = ({ r: 'rect', o: 'ellipse', d: 'diamond', a: 'arrow', l: 'line' } as Record<string, ElType>)[tool];
    if (!type) { this.drag = null; this.hist.pop(); return; }
    const el = Object.assign(base, { type, x: this.snap(p.x), y: this.snap(p.y), w: 0, h: 0 });
    if (type === 'arrow' && CONFIG.bindArrows !== false) {
      const s = this.hitShape(p.x, p.y);
      if (s) el.startBinding = s.id;
    }
    this.els.push(el);
    this.drag = { mode: 'create', id: el.id, start: p };
    this.setState({ sel: [el.id] });
  }

  eraseAt(p: Point) {
    const hit = this.hit(p.x, p.y);
    if (!hit) return;
    this.els = this.els.filter((x) => x.id !== hit.id);
    for (const el of this.els) {
      if (el.startBinding === hit.id) el.startBinding = null;
      if (el.endBinding === hit.id) el.endBinding = null;
    }
    if (this.drag && this.drag.mode === 'erase') this.drag.erased = true;
    this.setState((s) => ({ sel: [], rev: s.rev + 1 }));
    this.queueSave();
  }

  move(e: PointerEvent) {
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size >= 2) { if (this.pinch) this.movePinch(); return; }
    }
    const d = this.drag;
    if (!d) return;
    const p = this.s2w(e);
    if (d.mode === 'pan') {
      this.view.x = d.vx - (e.clientX - d.sx) / this.view.z;
      this.view.y = d.vy - (e.clientY - d.sy) / this.view.z;
      this.draw(); return;
    }
    if (d.mode === 'move') {
      let dx = p.x - d.start.x, dy = p.y - d.start.y;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      for (const id of d.ids) { const el = this.byId(id), o = d.orig[id]; if (el && o) { el.x = this.snap(o.x + dx); el.y = this.snap(o.y + dy); } }
      d.moved = true; this.draw(); return;
    }
    if (d.mode === 'create') {
      const el = this.byId(d.id);
      if (!el) return;
      let w = p.x - d.start.x, h = p.y - d.start.y;
      if (e.shiftKey && el.type !== 'arrow' && el.type !== 'line') { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      el.w = this.snap(w); el.h = this.snap(h);
      if (el.type === 'arrow' && CONFIG.bindArrows !== false) {
        const s = this.hitShape(p.x, p.y);
        el.endBinding = s && s.id !== el.startBinding ? s.id : null;
      }
      this.draw(); return;
    }
    if (d.mode === 'laser') { this.laserTrail.push({ x: p.x, y: p.y, t: performance.now() }); this.laserTick(); return; }
    if (d.mode === 'erase') { this.eraseAt(p); return; }
    if (d.mode === 'draw') {
      const el = this.byId(d.id);
      if (!el) return;
      const last = el.points![el.points!.length - 1];
      const nx = p.x - el.x, ny = p.y - el.y;
      if (Math.hypot(nx - last[0], ny - last[1]) > 1.5 / this.view.z) el.points!.push([nx, ny]);
      this.draw(); return;
    }
    if (d.mode === 'resize') {
      const el = this.byId(d.id), o = d.orig;
      if (!el) return;
      if (d.k === 'p0') { el.x = this.snap(p.x); el.w = o.x + o.w - el.x; el.startBinding = null; }
      else if (d.k === 'p1') { el.w = this.snap(p.x) - el.x; el.h = this.snap(p.y) - el.y; el.endBinding = null; }
      else {
        const b = this.box(o);
        let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
        if (d.k.indexOf('w') >= 0) x0 = this.snap(p.x);
        if (d.k.indexOf('e') >= 0) x1 = this.snap(p.x);
        if (d.k.indexOf('n') >= 0) y0 = this.snap(p.y);
        if (d.k.indexOf('s') >= 0) y1 = this.snap(p.y);
        if (el.type === 'draw') {
          const sx = (x1 - x0) / (b.w || 1), sy = (y1 - y0) / (b.h || 1);
          el.x = x0; el.y = y0;
          el.points = o.points!.map((q) => [q[0] * sx, q[1] * sy]);
          el.w = x1 - x0; el.h = y1 - y0;
        } else if (el.type === 'text') {
          el.fontSize = Math.max(8, Math.round(o.fontSize * ((y1 - y0) / (b.h || 1))));
          this.measure(el);
        } else { el.x = x0; el.y = y0; el.w = x1 - x0; el.h = y1 - y0; }
      }
      if (d.k === 'p0' && CONFIG.bindArrows !== false) { const s = this.hitShape(p.x, p.y); if (s) el.startBinding = s.id; }
      if (d.k === 'p1' && CONFIG.bindArrows !== false) { const s = this.hitShape(p.x, p.y); if (s && s.id !== el.startBinding) el.endBinding = s.id; }
      this.draw(); return;
    }
    if (d.mode === 'marquee') { d.b = p; this.draw(); return; }
  }

  up(e: PointerEvent) {
    if (e && e.pointerType === 'touch') {
      this.touches.delete(e.pointerId);
      if (this.pinch) {
        if (this.touches.size < 2) { this.pinch = null; this.drag = null; this.setState((s) => ({ rev: s.rev + 1 })); this.queueSave(); }
        return;
      }
    }
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.mode === 'pan') { this.queueSave(); this.setState((s) => ({ rev: s.rev + 1 })); return; }
    if (d.mode === 'marquee') {
      const x0 = Math.min(d.a.x, d.b.x), x1 = Math.max(d.a.x, d.b.x), y0 = Math.min(d.a.y, d.b.y), y1 = Math.max(d.a.y, d.b.y);
      const tiny = Math.abs(x1 - x0) < 3 && Math.abs(y1 - y0) < 3;
      const ids = tiny ? [] : this.els.filter((el) => { const b = this.bbox([el]); return b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0; }).map((el) => el.id);
      this.setState((s) => ({ sel: e.shiftKey ? s.sel.concat(ids.filter((i) => s.sel.indexOf(i) < 0)) : ids, rev: s.rev + 1, live: ids.length + ' selected' }));
      return;
    }
    if (d.mode === 'laser') return;
    if (d.mode === 'erase') {
      if (!d.erased) this.hist.pop();
      this.setState((s) => ({ rev: s.rev + 1 }));
      return;
    }
    if (d.mode === 'create') {
      const el = this.byId(d.id);
      if (el) {
        const tiny = Math.abs(el.w) < 4 && Math.abs(el.h) < 4;
        if (tiny && el.type === 'sticky') { el.w = 160; el.h = 160; }
        if (tiny && (el.type === 'arrow' || el.type === 'line')) { this.els = this.els.filter((x) => x.id !== el.id); this.hist.pop(); this.setState({ sel: [] }); }
        else if (tiny) { el.w = 140; el.h = 80; }
        if (el.w < 0 && el.type !== 'arrow' && el.type !== 'line') { el.x += el.w; el.w = -el.w; }
        if (el.h < 0 && el.type !== 'arrow' && el.type !== 'line') { el.y += el.h; el.h = -el.h; }
        if (el.endBinding) this.toast('Arrow connected — it follows both shapes now.');
      }
      this.setState((s) => ({ rev: s.rev + 1, tool: CONFIG.stickyTools ? s.tool : 'v' }));
      this.queueSave();
      return;
    }
    if (d.mode === 'draw') {
      const el = this.byId(d.id);
      if (el) {
        if (el.points!.length < 3) { this.els = this.els.filter((x) => x.id !== el.id); this.hist.pop(); }
        else {
          const xs = el.points!.map((q) => q[0]), ys = el.points!.map((q) => q[1]);
          const mnx = Math.min.apply(null, xs), mny = Math.min.apply(null, ys);
          el.x += mnx; el.y += mny;
          el.points = el.points!.map((q) => [q[0] - mnx, q[1] - mny]);
          el.w = Math.max.apply(null, xs) - mnx; el.h = Math.max.apply(null, ys) - mny;
          if (this.state.drawMode === 'shape') {
            const g = this.guessShape(el);
            if (g) {
              delete el.points;
              Object.assign(el, g);
              if (g.type !== 'line' && this.state.style.fill && this.state.style.fill !== 'transparent') el.fill = this.state.style.fill;
            }
          }
        }
      }
      this.setState((s) => ({ rev: s.rev + 1, tool: CONFIG.stickyTools ? s.tool : 'v' }));
      this.queueSave();
      return;
    }
    if (d.mode === 'move' && !d.moved) this.hist.pop();
    this.setState((s) => ({ rev: s.rev + 1 }));
    this.queueSave();
  }

  wheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const r = this.canvas!.getBoundingClientRect();
      const mx = (e.clientX - r.left) / this.view.z + this.view.x;
      const my = (e.clientY - r.top) / this.view.z + this.view.y;
      const z = Math.max(0.2, Math.min(4, this.view.z * (1 - e.deltaY / 400)));
      this.view.x = mx - (e.clientX - r.left) / z;
      this.view.y = my - (e.clientY - r.top) / z;
      this.view.z = z;
    } else {
      this.view.x += e.deltaX / this.view.z;
      this.view.y += e.deltaY / this.view.z;
    }
    this.draw();
    clearTimeout(this.viewT);
    this.viewT = setTimeout(() => { this.setState((s) => ({ rev: s.rev + 1 })); this.queueSave(); }, 180);
  }

  dbl(e: MouseEvent) {
    const p = this.s2w(e);
    const hit = this.hit(p.x, p.y);
    if (hit) { this.startEdit(hit.id, hit.type !== 'text'); return; }
    this.push();
    const st = this.state.style;
    const el: El = { id: this.uid(), type: 'text', x: p.x, y: p.y - st.fontSize * 0.6, text: '', w: 0, h: st.fontSize * 1.25, stroke: st.stroke, fill: 'transparent', sw: st.sw, opacity: st.opacity, fontSize: st.fontSize, label: '', dash: 'solid', rough: 0, curve: 'straight' };
    this.els.push(el);
    this.setState({ sel: [el.id] }, () => this.startEdit(el.id, false));
  }

  /* ---------- text editing ---------- */

  startEdit(id: string, isLabel: boolean) {
    const el = this.byId(id);
    if (!el) return;
    if (el.type !== 'text' && !isLabel) isLabel = true;
    this.setState({ editing: { id, isLabel, value: isLabel ? (el.label || '') : (el.text || '') }, sel: [id] });
  }

  placeEditor() {
    const ed = this.state.editing;
    if (!ed || !this.editEl || !this.canvas) return;
    const el = this.byId(ed.id);
    if (!el) return;
    const z = this.view.z, b = this.box(el);
    const n = this.editEl;
    const left = (b.x - this.view.x) * z, top = (b.y - this.view.y) * z;
    if (ed.isLabel) {
      n.style.left = left + 'px'; n.style.top = (top + b.h / 2 - el.fontSize * z * 0.7) + 'px';
      n.style.width = Math.max(40, b.w) * z + 'px'; n.style.height = el.fontSize * 1.4 * z + 'px';
      n.style.textAlign = 'center';
    } else {
      n.style.left = left + 'px'; n.style.top = top + 'px';
      n.style.width = Math.max(80, b.w + 20) * z + 'px'; n.style.height = Math.max(el.fontSize * 1.4, b.h) * z + 'px';
      n.style.textAlign = 'left';
    }
    n.style.fontSize = el.fontSize * z + 'px';
    n.style.color = el.stroke;
    if (n.value !== ed.value) n.value = ed.value;
  }

  commitEdit() {
    const ed = this.state.editing;
    if (!ed) return;
    const el = this.byId(ed.id);
    const v = this.editEl ? this.editEl.value : ed.value;
    if (el) {
      this.push();
      if (ed.isLabel) el.label = v.slice(0, 200);
      else {
        el.text = v.slice(0, 400);
        if (!el.text.trim()) this.els = this.els.filter((x) => x.id !== el.id);
        else this.measure(el);
      }
    }
    this.setState((s) => ({ editing: null, rev: s.rev + 1 }));
    this.queueSave();
    if (this.canvas) this.canvas.focus();
  }

  measure(el: El) {
    const ctx = this.canvas ? this.canvas.getContext('2d') : null;
    const lines = String(el.text || '').split('\n');
    let w = 0;
    if (ctx) { ctx.save(); ctx.font = '400 ' + el.fontSize + "px 'IBM Plex Sans', sans-serif"; for (const l of lines) w = Math.max(w, ctx.measureText(l).width); ctx.restore(); }
    else w = el.fontSize * 0.55 * Math.max.apply(null, lines.map((l) => l.length));
    el.w = Math.max(8, w); el.h = lines.length * el.fontSize * 1.25;
  }

  /* ---------- keyboard ---------- */

  handleKey(e: KeyboardEvent) {
    const tag = ((e.target as HTMLElement) && (e.target as HTMLElement).tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    if (e.code === 'Space' && !typing) { this.space = true; }
    if (typing) {
      if (e.key === 'Escape') { if (this.state.editing) this.commitEdit(); else (e.target as HTMLElement).blur(); }
      if (e.key === 'Enter' && tag === 'TEXTAREA' && (e.metaKey || e.ctrlKey)) this.commitEdit();
      if (e.key === 'Enter' && tag === 'INPUT') (e.target as HTMLElement).blur();
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); this.toggleTheme(); return; }
    if (e.key === 'Escape' && this.state.menuOpen) { this.setState({ menuOpen: false }); return; }
    if (e.key === 'Escape' && (this.state.authOpen || this.state.accountOpen)) { this.setState({ authOpen: false, authBusy: false, accountOpen: false, signOutAsk: false }); return; }
    if (e.key === 'Escape' && this.state.view === 'gallery' && !/^(input|textarea)$/i.test(((e.target as HTMLElement) && (e.target as HTMLElement).tagName) || '')) { this.setState({ view: 'canvas' }, () => this.draw()); return; }
    if (e.key === 'Escape' && (this.state.help || this.state.embedOpen || this.state.mermaidOpen || this.state.libOpen)) { this.setState({ help: false, embedOpen: false, mermaidOpen: false, libOpen: false }); return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); this.setState({ sel: this.els.map((x) => x.id), live: 'All selected' }); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); this.dup(); return; }
    if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); this.exportSvg(); return; }
    if (mod) return;
    const k = e.key.toLowerCase();
    if (k === 'i') { this.pickImage(); return; }
    if (e.shiftKey && k === 'x') { e.preventDefault(); this.toShape(); return; }
    if (['v', 'r', 'o', 'd', 'a', 'l', 'p', 't', 's', 'f', 'e', 'k', 'b', 'h'].indexOf(k) >= 0) { this.setState({ tool: k as Tool, live: 'Tool: ' + k }); return; }
    if (e.key === 'Escape') { this.setState({ sel: [], help: false }); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.del(); return; }
    if (e.key === 'Enter' && this.state.sel.length === 1) { e.preventDefault(); const el = this.byId(this.state.sel[0]); if (el) this.startEdit(el.id, el.type !== 'text'); return; }
    if (e.key.indexOf('Arrow') === 0 && this.state.sel.length) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      this.push();
      for (const id of this.state.sel) { const el = this.byId(id); if (el) { el.x += dx; el.y += dy; } }
      this.setState((s) => ({ rev: s.rev + 1 }));
      this.queueSave();
    }
  }

  /* ---------- edits ---------- */

  del() {
    const sel = this.state.sel;
    if (!sel.length) return this.toast('Select something first.');
    this.push();
    this.els = this.els.filter((e) => sel.indexOf(e.id) < 0);
    for (const e of this.els) {
      if (e.startBinding && sel.indexOf(e.startBinding) >= 0) e.startBinding = null;
      if (e.endBinding && sel.indexOf(e.endBinding) >= 0) e.endBinding = null;
    }
    this.setState((s) => ({ sel: [], rev: s.rev + 1, live: sel.length + ' deleted' }));
    this.queueSave();
  }

  dup() {
    const sel = this.state.sel;
    if (!sel.length) return this.toast('Select something first.');
    this.push();
    const map: Record<string, string> = {}, copies: El[] = [];
    for (const id of sel) {
      const el = this.byId(id);
      if (!el) continue;
      const c: El = JSON.parse(JSON.stringify(el));
      c.id = this.uid(); c.x += 16; c.y += 16;
      map[id] = c.id; copies.push(c);
    }
    for (const c of copies) {
      if (c.startBinding && map[c.startBinding]) c.startBinding = map[c.startBinding];
      if (c.endBinding && map[c.endBinding]) c.endBinding = map[c.endBinding];
    }
    this.els = this.els.concat(copies);
    this.setState((s) => ({ sel: copies.map((c) => c.id), rev: s.rev + 1 }));
    this.queueSave();
  }

  order(front: boolean) {
    const sel = this.state.sel;
    if (!sel.length) return;
    this.push();
    const picked = this.els.filter((e) => sel.indexOf(e.id) >= 0);
    const rest = this.els.filter((e) => sel.indexOf(e.id) < 0);
    this.els = front ? rest.concat(picked) : picked.concat(rest);
    this.setState((s) => ({ rev: s.rev + 1 }));
    this.queueSave();
  }

  /* ---------- laser pointer ---------- */

  laserTick() {
    if (this.laserRAF) return;
    const step = () => {
      this.laserRAF = null;
      const now = performance.now();
      this.laserTrail = this.laserTrail.filter((p) => now - p.t < 1000);
      this.draw();
      if (this.laserTrail.length) { this.laserRAF = requestAnimationFrame(step); }
    };
    this.laserRAF = requestAnimationFrame(step);
  }

  paintLaser(ctx: CanvasRenderingContext2D) {
    const pts = this.laserTrail;
    if (pts.length < 2) return;
    const now = performance.now();
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const age = (now - pts[i].t) / 1000;
      if (age >= 1) continue;
      const a = 1 - age;
      ctx.strokeStyle = 'rgba(224,49,49,' + (a * 0.9).toFixed(3) + ')';
      ctx.lineWidth = (2 + a * 5) / this.view.z;
      ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
    const head = pts[pts.length - 1];
    ctx.fillStyle = 'rgba(224,49,49,0.95)';
    ctx.beginPath(); ctx.arc(head.x, head.y, 4 / this.view.z, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
  /* ---------- draw to shape ---------- */

  toShape() {
    const draws = this.state.sel.map((id) => this.byId(id)).filter((e): e is El => !!e && e.type === 'draw');
    if (!draws.length) return this.toast('Select one or more freedraw strokes first.', 'bad');
    this.push();
    let n = 0;
    for (const el of draws) {
      const g = this.guessShape(el);
      if (!g) continue;
      delete el.points;
      Object.assign(el, g);
      n++;
    }
    this.setState((s) => ({ rev: s.rev + 1, live: 'Converted ' + n + ' stroke(s)' }));
    this.queueSave();
    this.toast(n ? 'Snapped ' + n + ' stroke' + (n === 1 ? '' : 's') + ' to a shape.' : 'Could not read a shape from that stroke.', n ? 'ok' : 'bad');
  }

  /* absolute vertices of a triangle element; el.tri holds 3 unit-square points */
  triPts(el: El): [number, number][] {
    const b = this.box(el);
    const t = (el.tri && el.tri.length === 3) ? el.tri : [[0.5, 0], [1, 1], [0, 1]] as [number, number][];
    return t.map((q) => [b.x + q[0] * b.w, b.y + q[1] * b.h] as [number, number]);
  }

  /* Ramer-Douglas-Peucker on an open point list */
  rdp(pts: [number, number][], eps: number): [number, number][] {
    if (pts.length < 3) return pts.slice();
    let idx = 0, max = 0;
    const a = { x: pts[0][0], y: pts[0][1] }, b = { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
    for (let i = 1; i < pts.length - 1; i++) {
      const d = this.distSeg(pts[i][0], pts[i][1], a, b);
      if (d > max) { max = d; idx = i; }
    }
    if (max <= eps) return [pts[0], pts[pts.length - 1]];
    const left = this.rdp(pts.slice(0, idx + 1), eps), right = this.rdp(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }

  /* corner list of a closed stroke, rotated so a real corner is the endpoint */
  corners(p: [number, number][], eps: number): [number, number][] {
    let mx = 0, my = 0;
    for (const q of p) { mx += q[0]; my += q[1]; }
    mx /= p.length; my /= p.length;
    let far = 0, fd = -1;
    for (let i = 0; i < p.length; i++) { const d = Math.hypot(p[i][0] - mx, p[i][1] - my); if (d > fd) { fd = d; far = i; } }
    const rot = p.slice(far).concat(p.slice(0, far));
    rot.push(rot[0]);
    const out = this.rdp(rot, eps);
    out.pop();
    return out;
  }

  guessShape(el: El): Partial<El> | null {
    const p = el.points;
    if (!p || p.length < 3) return null;
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    const w = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    const h = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    const first = p[0], last = p[p.length - 1];
    const span = Math.hypot(w, h) || 1;
    const closed = Math.hypot(last[0] - first[0], last[1] - first[1]) / span < 0.25;
    if (!closed) {
      // open stroke: straight enough becomes a line, otherwise leave it
      let maxDev = 0;
      for (const q of p) maxDev = Math.max(maxDev, this.distSeg(q[0], q[1], { x: first[0], y: first[1] }, { x: last[0], y: last[1] }));
      if (maxDev / span > 0.14) return null;
      return { type: 'line', x: el.x + first[0], y: el.y + first[1], w: last[0] - first[0], h: last[1] - first[1] };
    }
    // closed stroke: how well does it hug the bounding box corners?
    const cx = w / 2, cy = h / 2, rx = w / 2 || 1, ry = h / 2 || 1;
    let ell = 0;
    for (const q of p) {
      const d = Math.hypot((q[0] - Math.min.apply(null, xs) - cx) / rx, (q[1] - Math.min.apply(null, ys) - cy) / ry);
      ell += Math.abs(d - 1);
    }
    ell /= p.length;
    const x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    const base: Partial<El> = { x: el.x + x0, y: el.y + y0, w, h };
    if (ell < 0.13) return Object.assign(base, { type: 'ellipse' as ElType });
    const cor = this.corners(p, span * 0.075);
    if (cor.length === 3) {
      const tri = cor.map((q) => [(q[0] - x0) / (w || 1), (q[1] - y0) / (h || 1)] as [number, number]);
      return Object.assign(base, { type: 'triangle' as ElType, tri });
    }
    if (cor.length === 4) {
      // corners near bbox corners means rectangle; near edge midpoints means diamond
      let dCorner = 0, dMid = 0;
      const cs = [[0, 0], [1, 0], [1, 1], [0, 1]], ms = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];
      for (const q of cor) {
        const u = (q[0] - x0) / (w || 1), v = (q[1] - y0) / (h || 1);
        dCorner += Math.min.apply(null, cs.map((c) => Math.hypot(u - c[0], v - c[1])));
        dMid += Math.min.apply(null, ms.map((c) => Math.hypot(u - c[0], v - c[1])));
      }
      return Object.assign(base, { type: (dMid < dCorner ? 'diamond' : 'rect') as ElType });
    }
    return Object.assign(base, { type: (ell < 0.2 ? 'ellipse' : 'rect') as ElType });
  }

  /* ---------- mermaid import (offline subset) ---------- */

  mermaid(src: string) {
    const lines = String(src).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return this.toast('Paste a Mermaid flowchart first.', 'bad');
    const dirLine = lines[0].match(/^(?:graph|flowchart)\s+(TB|TD|BT|LR|RL)/i);
    const dir = dirLine ? dirLine[1].toUpperCase() : 'TD';
    const horizontal = dir === 'LR' || dir === 'RL';
    const nodes = new Map<string, { id: string; label: string; shape: string }>();
    const edges: { a: string; b: string; label: string; dashed: boolean }[] = [];
    const shapeOf = (open: string) => (open === '{' ? 'diamond' : open === '(' ? 'ellipse' : 'rect');
    const node = (id: string, label?: string, shape?: string | null) => {
      if (!nodes.has(id)) nodes.set(id, { id, label: label || id, shape: shape || 'rect' });
      else { const n = nodes.get(id)!; if (label) n.label = label; if (shape) n.shape = shape; }
      return nodes.get(id)!;
    };
    const NODE = /([A-Za-z0-9_]+)\s*(?:(\[|\(|\{)([^\])}]*)(?:\]|\)|\}))?/g;
    for (const line of lines.slice(dirLine ? 1 : 0)) {
      const arrow = line.match(/^(.*?)\s*(-{2,3}>|-{2,3}|={2,3}>)\s*(?:\|([^|]*)\|)?\s*(.*)$/);
      if (arrow) {
        const parse = (side: string) => {
          NODE.lastIndex = 0;
          const m = NODE.exec(side.trim());
          if (!m) return null;
          return node(m[1], m[3], m[2] ? shapeOf(m[2]) : null);
        };
        const a = parse(arrow[1]), b = parse(arrow[4]);
        if (a && b) edges.push({ a: a.id, b: b.id, label: (arrow[3] || '').trim(), dashed: /^-{2,3}$/.test(arrow[2]) });
        continue;
      }
      NODE.lastIndex = 0;
      const m = NODE.exec(line);
      if (m && m[2]) node(m[1], m[3], shapeOf(m[2]));
    }
    if (!nodes.size) return this.toast('No nodes found. Supported: graph TD, A[Label], A --> B, A -->|yes| B.', 'bad');
    // layered layout by longest path from a root
    const list = [...nodes.values()];
    const depth = new Map<string, number>(list.map((n) => [n.id, 0]));
    for (let pass = 0; pass < list.length; pass++) {
      let moved = false;
      for (const e of edges) {
        const d = depth.get(e.a)! + 1;
        if (d > depth.get(e.b)!) { depth.set(e.b, d); moved = true; }
      }
      if (!moved) break;
    }
    const rows = new Map<number, { id: string; label: string; shape: string }[]>();
    for (const n of list) {
      const d = depth.get(n.id)!;
      if (!rows.has(d)) rows.set(d, []);
      rows.get(d)!.push(n);
    }
    const W = 170, H = 72, GX = 70, GY = 70;
    const made = new Map<string, El>();
    const origin = this.viewCentre();
    for (const [d, row] of rows) {
      row.forEach((n, i) => {
        const off = (i - (row.length - 1) / 2);
        const x = origin.x + (horizontal ? d * (W + GX) : off * (W + GX)) - W / 2;
        const y = origin.y + (horizontal ? off * (H + GY) : d * (H + GY)) - H / 2;
        made.set(n.id, {
          id: this.uid(), type: n.shape as ElType, x: Math.round(x), y: Math.round(y), w: W, h: n.shape === 'diamond' ? H + 30 : H,
          label: n.label, stroke: '#1e1e1e', fill: n.shape === 'diamond' ? '#ffec99' : '#a5d8ff', sw: 2, opacity: 1, fontSize: 16, dash: 'solid', rough: 0, curve: 'straight',
        });
      });
    }
    const out: El[] = [...made.values()];
    for (const e of edges) {
      const a = made.get(e.a), b = made.get(e.b);
      if (!a || !b) continue;
      out.push({
        id: this.uid(), type: 'arrow', x: 0, y: 0, w: 0, h: 0, startBinding: a.id, endBinding: b.id,
        stroke: '#1e1e1e', fill: 'transparent', sw: 2, opacity: 1, fontSize: 14, label: e.label || '', dash: e.dashed ? 'dashed' : 'solid', rough: 0, curve: 'straight',
      });
    }
    this.push();
    this.els = this.els.concat(out);
    this.setState((s) => ({ sel: out.map((x) => x.id), rev: s.rev + 1, mermaidOpen: false, view: 'canvas' }), () => this.fit());
    this.queueSave();
    this.toast('Imported ' + made.size + ' nodes and ' + (out.length - made.size) + ' connectors.');
  }

  viewCentre(): Point {
    if (!this.canvas) return { x: 400, y: 300 };
    return { x: this.canvas.clientWidth / 2 / this.view.z + this.view.x, y: this.canvas.clientHeight / 2 / this.view.z + this.view.y };
  }

  /* ---------- web embed ---------- */

  addEmbed(raw: string) {
    let url = String(raw || '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let u: URL;
    try { u = new URL(url); } catch { return this.toast('That is not a valid URL.', 'bad'); }
    if (u.protocol !== 'https:') return this.toast('Embeds must use https.', 'bad');
    const c = this.viewCentre();
    const w = 420, h = 260;
    this.push();
    const el: El = {
      id: this.uid(), type: 'embed', src: u.href, x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), w, h,
      stroke: '#1e1e1e', fill: 'transparent', sw: 2, opacity: 1, fontSize: 14, label: '', dash: 'solid', rough: 0, curve: 'straight',
    };
    this.els.push(el);
    this.setState((s) => ({ sel: [el.id], rev: s.rev + 1, embedOpen: false, embedUrl: '', tool: 'v' }));
    this.queueSave();
  }

  caps(type: ElType): string[] {
    const CAP: Record<ElType, string[]> = {
      rect: ['stroke', 'fill', 'sw', 'dash', 'rough'], ellipse: ['stroke', 'fill', 'sw', 'dash', 'rough'],
      diamond: ['stroke', 'fill', 'sw', 'dash', 'rough'], triangle: ['stroke', 'fill', 'sw', 'dash', 'rough'], line: ['stroke', 'sw', 'dash', 'rough', 'curve', 'heads'],
      arrow: ['stroke', 'sw', 'dash', 'rough', 'curve', 'heads'], draw: ['stroke', 'sw', 'rough'],
      text: ['stroke', 'fontSize'], sticky: ['stroke', 'fill', 'fontSize'],
      frame: ['stroke', 'sw', 'dash'], image: [], embed: [],
    };
    return CAP[type] || [];
  }

  setStyle(patch: Partial<StyleDefaults & { head: Head; tail: Head }>) {
    const sel = this.state.sel;
    if (sel.length) {
      this.push();
      for (const id of sel) {
        const el = this.byId(id);
        if (!el) continue;
        const allow = this.caps(el.type).concat(['opacity']);
        if (allow.indexOf('heads') >= 0) allow.push('head', 'tail');
        const ok: Record<string, unknown> = {};
        (Object.keys(patch) as (keyof typeof patch)[]).forEach((k) => { if (allow.indexOf(k) >= 0) ok[k] = patch[k]; });
        Object.assign(el, ok);
        if (el.type === 'text' && patch.fontSize) this.measure(el);
      }
      this.queueSave();
    }
    this.setState((s) => ({ style: Object.assign({}, s.style, patch), rev: s.rev + 1 }));
  }

  /* ---------- rendering ---------- */

  draw() {
    const c = this.canvas;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const z = this.view.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.state.theme === 'dark' ? '#131417' : '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, -this.view.x * z * dpr, -this.view.y * z * dpr);
    this.grid(ctx, w / z, h / z);
    this.paint(ctx, this.els);
    this.overlay(ctx);
    this.paintLaser(ctx);
    this.syncEmbeds();
  }

  syncEmbeds() {
    const layer = this.embedLayer;
    if (!layer) return;
    const z = this.view.z;
    layer.style.transform = 'translate(' + (-this.view.x * z) + 'px,' + (-this.view.y * z) + 'px) scale(' + z + ')';
    const want = this.els.filter((e) => e.type === 'embed');
    const seen = new Set<string>();
    for (const el of want) {
      seen.add(el.id);
      let node = layer.querySelector('[data-embed="' + el.id + '"]') as HTMLIFrameElement | null;
      if (!node) {
        node = document.createElement('iframe');
        node.setAttribute('data-embed', el.id);
        node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
        node.setAttribute('referrerpolicy', 'no-referrer');
        node.setAttribute('loading', 'lazy');
        node.style.cssText = 'position:absolute;border:0;border-radius:6px;background:#FFFFFF;pointer-events:none';
        node.src = el.src!;
        layer.appendChild(node);
      } else if (node.src !== el.src) node.src = el.src!;
      node.style.left = el.x + 'px';
      node.style.top = el.y + 'px';
      node.style.width = Math.max(1, el.w) + 'px';
      node.style.height = Math.max(1, el.h) + 'px';
      node.style.opacity = String(el.opacity == null ? 1 : el.opacity);
      // only the selected embed is interactive, so drags on the canvas still work
      node.style.pointerEvents = this.state.sel.length === 1 && this.state.sel[0] === el.id ? 'auto' : 'none';
    }
    for (const node of [...layer.children]) if (!seen.has(node.getAttribute('data-embed') || '')) node.remove();
  }

  grid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const mode = CONFIG.grid || 'dots';
    if (mode === 'none' || this.view.z < 0.5) return;
    const g = 20, x0 = Math.floor(this.view.x / g) * g, y0 = Math.floor(this.view.y / g) * g;
    ctx.save();
    if (mode === 'lines') {
      ctx.strokeStyle = this.state.theme === 'dark' ? '#232529' : '#F3F3F3'; ctx.lineWidth = 1 / this.view.z;
      for (let x = x0; x < this.view.x + w + g; x += g) { ctx.beginPath(); ctx.moveTo(x, this.view.y); ctx.lineTo(x, this.view.y + h); ctx.stroke(); }
      for (let y = y0; y < this.view.y + h + g; y += g) { ctx.beginPath(); ctx.moveTo(this.view.x, y); ctx.lineTo(this.view.x + w, y); ctx.stroke(); }
    } else {
      ctx.fillStyle = this.state.theme === 'dark' ? '#2E3036' : '#E5E5E5';
      const r = 1 / this.view.z;
      for (let x = x0; x < this.view.x + w + g; x += g) for (let y = y0; y < this.view.y + h + g; y += g) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
    }
    ctx.restore();
  }

  paint(ctx: CanvasRenderingContext2D, list: El[]) { for (const el of list) this.paintEl(ctx, el); }

  toggleTheme() {
    const next = this.state.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('slate.theme', next); } catch { /* storage blocked */ }
    this.setState((p) => ({ theme: next, rev: p.rev + 1, live: next === 'dark' ? 'Dark mode on' : 'Light mode on' }));
  }

  /* dark mode flips lightness at paint time; stored colours and exports are untouched */
  ink(c: string): string {
    if (!c || c === 'transparent') return c;
    if (!(this.state.theme === 'dark' && !this.exporting)) return c;
    this.inkCache = this.inkCache || {};
    if (this.inkCache[c]) return this.inkCache[c];
    let h = String(c).trim();
    if (h[0] !== '#') return c;
    if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    if (h.length !== 7) return c;
    const R8 = parseInt(h.slice(1, 3), 16) / 255, G8 = parseInt(h.slice(3, 5), 16) / 255, B8 = parseInt(h.slice(5, 7), 16) / 255;
    const mx = Math.max(R8, G8, B8), mn = Math.min(R8, G8, B8), l = (mx + mn) / 2, d = mx - mn;
    let hu = 0, sa = 0;
    if (d) {
      sa = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      hu = mx === R8 ? (G8 - B8) / d + (G8 < B8 ? 6 : 0) : mx === G8 ? (B8 - R8) / d + 2 : (R8 - G8) / d + 4;
      hu /= 6;
    }
    const nl = Math.min(0.93, Math.max(0.07, 1 - l));
    const q = nl < 0.5 ? nl * (1 + sa) : nl + sa - nl * sa, p = 2 * nl - q;
    const ch = (t: number) => {
      t = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    const out = sa === 0
      ? '#' + [nl, nl, nl].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
      : '#' + ch(hu + 1 / 3) + ch(hu) + ch(hu - 1 / 3);
    this.inkCache[c] = out;
    return out;
  }

  seed(el: El): number {
    const s = String(el.id || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296) - 0.5;
    };
  }

  dashArr(el: El): number[] {
    const w = Math.max(1, el.sw || 2);
    if (el.dash === 'dashed') return [w * 4, w * 3.2];
    if (el.dash === 'dotted') return [Math.max(0.6, w * 0.55), w * 2.4];
    return [];
  }

  /* one hand-drawn stroke of a straight segment, two overlapping passes */
  rline(ctx: CanvasRenderingContext2D, r: () => number, k: number, x1: number, y1: number, x2: number, y2: number) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const amp = Math.min(k * (0.7 + len * 0.012), k * 5);
    const j = (m?: number) => r() * 2 * amp * (m == null ? 1 : m);
    ctx.moveTo(x1 + j(0.5), y1 + j(0.5));
    ctx.bezierCurveTo(
      x1 + (x2 - x1) * 0.32 + j(), y1 + (y2 - y1) * 0.32 + j(),
      x1 + (x2 - x1) * 0.68 + j(), y1 + (y2 - y1) * 0.68 + j(),
      x2 + j(0.5), y2 + j(0.5)
    );
  }

  /* cardinal spline through points, appended to the current path */
  curve(ctx: CanvasRenderingContext2D, p: [number, number][], closed: boolean) {
    const n = p.length;
    if (n < 2) return;
    const at = (i: number) => p[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    ctx.moveTo(at(0)[0], at(0)[1]);
    const end = closed ? n : n - 1;
    for (let i = 0; i < end; i++) {
      const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
      ctx.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
    }
  }

  rpoly(ctx: CanvasRenderingContext2D, r: () => number, k: number, pts: [number, number][]) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      this.rline(ctx, r, k, a[0], a[1], b[0], b[1]);
    }
  }

  rellipse(ctx: CanvasRenderingContext2D, r: () => number, k: number, cx: number, cy: number, rx: number, ry: number) {
    const steps = 13;
    const amp = Math.min(k * (0.7 + Math.min(Math.abs(rx), Math.abs(ry)) * 0.02), k * 4);
    const off = r() * 0.6;
    const pts: [number, number][] = [];
    for (let i = 0; i < steps; i++) {
      const a = off + (i / steps) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * (rx + r() * 2 * amp), cy + Math.sin(a) * (ry + r() * 2 * amp)]);
    }
    this.curve(ctx, pts, true);
  }
  paintEl(ctx: CanvasRenderingContext2D, el: El) {
    ctx.save();
    ctx.globalAlpha = el.opacity == null ? 1 : el.opacity;
    ctx.lineWidth = el.sw || 2;
    ctx.strokeStyle = this.ink(el.stroke || '#1e1e1e');
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const b = this.box(el);
    const k = (el.rough || 0) * 1.9;
    const r = k ? this.rng(this.seed(el)) : null;
    const dash = this.dashArr(el);
    ctx.setLineDash(dash);
    const doFill = (path: () => void) => {
      if (!el.fill || el.fill === 'transparent') return;
      ctx.save(); ctx.setLineDash([]); ctx.beginPath(); path(); ctx.fillStyle = this.ink(el.fill); ctx.fill(); ctx.restore();
    };
    if (el.type === 'rect') {
      const rad = k ? 0 : Math.min(8, Math.abs(b.w) / 4, Math.abs(b.h) / 4);
      doFill(() => this.roundRect(ctx, b.x, b.y, b.w, b.h, rad));
      if (k) {
        ctx.beginPath();
        this.rpoly(ctx, r!, k, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]);
        ctx.stroke();
      } else { this.roundRect(ctx, b.x, b.y, b.w, b.h, rad); ctx.stroke(); }
    } else if (el.type === 'ellipse') {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = Math.abs(b.w / 2), ry = Math.abs(b.h / 2);
      doFill(() => ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.2832));
      ctx.beginPath();
      if (k) this.rellipse(ctx, r!, k, cx, cy, rx, ry);
      else ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.2832);
      ctx.stroke();
    } else if (el.type === 'diamond') {
      const pts: [number, number][] = [[b.x + b.w / 2, b.y], [b.x + b.w, b.y + b.h / 2], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h / 2]];
      doFill(() => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); });
      ctx.beginPath();
      if (k) this.rpoly(ctx, r!, k, pts);
      else { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
      ctx.stroke();
    } else if (el.type === 'triangle') {
      const pts = this.triPts(el);
      doFill(() => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 3; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); });
      ctx.beginPath();
      if (k) this.rpoly(ctx, r!, k, pts);
      else { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 3; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
      ctx.stroke();
    } else if (el.type === 'line' || el.type === 'arrow') {
      const p = this.linePts(el);
      ctx.beginPath();
      if (k) { for (let i = 1; i < p.length; i++) this.rline(ctx, r!, k, p[i - 1].x, p[i - 1].y, p[i].x, p[i].y); }
      else if (el.curve === 'curved' && p.length > 2) this.curve(ctx, p.map((q) => [q.x, q.y] as [number, number]), false);
      else { ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y); }
      ctx.stroke();
      const colour = this.ink(el.stroke || '#1e1e1e'), sw = el.sw || 2;
      const last = p[p.length - 1], prev = p[p.length - 2] || p[0];
      const first = p[0], second = p[1] || p[p.length - 1];
      const endKind = el.head == null ? (el.type === 'arrow' ? 'arrow' : 'none') : el.head;
      this.head(ctx, endKind, last, Math.atan2(last.y - prev.y, last.x - prev.x), sw, colour);
      this.head(ctx, el.tail || 'none', first, Math.atan2(first.y - second.y, first.x - second.x), sw, colour);
      ctx.setLineDash(dash);
    } else if (el.type === 'draw') {
      ctx.beginPath();
      const pts = el.points!.map((q) => [el.x + q[0], el.y + q[1]] as [number, number]);
      if (k && pts.length > 2) {
        const amp = k * 0.5;
        this.curve(ctx, pts.map((q) => [q[0] + r!() * 2 * amp, q[1] + r!() * 2 * amp] as [number, number]), false);
      } else if (pts.length > 2) this.curve(ctx, pts, false);
      else { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
      ctx.stroke();
    } else if (el.type === 'text') {
      ctx.setLineDash([]);
      if (!el.w) this.measure(el);
      ctx.fillStyle = this.ink(el.stroke || '#1e1e1e');
      ctx.font = '400 ' + el.fontSize + "px 'IBM Plex Sans', sans-serif";
      ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      String(el.text || '').split('\n').forEach((l, i) => ctx.fillText(l, el.x, el.y + i * el.fontSize * 1.25));
    } else if (el.type === 'sticky') {
      ctx.setLineDash([]);
      ctx.fillStyle = this.ink(el.fill && el.fill !== 'transparent' ? el.fill : '#FFF3C0');
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1; ctx.stroke();
    } else if (el.type === 'frame') {
      ctx.setLineDash(dash.length ? dash : [6, 4]);
      ctx.strokeStyle = this.ink(el.stroke || '#9A9A9A');
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 4); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#8A8A8A';
      ctx.font = "500 12px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(el.name || 'Frame', b.x, b.y - 4);
    } else if (el.type === 'embed') {
      ctx.setLineDash([]);
      ctx.fillStyle = this.ink('#FFFFFF'); this.roundRect(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill();
      ctx.strokeStyle = this.ink('#C9C9C9'); ctx.lineWidth = 1; this.roundRect(ctx, b.x, b.y, b.w, b.h, 6); ctx.stroke();
      ctx.fillStyle = '#8A8A8A'; ctx.font = "400 12px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      let host = el.src!;
      try { host = new URL(el.src!).host; } catch { /* keep raw */ }
      ctx.fillText(host, b.x, b.y - 4);
    } else if (el.type === 'image') {
      ctx.setLineDash([]);
      const im = this.imgFor(el);
      if (im && im.complete && im.naturalWidth && !im.__bad) ctx.drawImage(im, b.x, b.y, b.w, b.h);
      else {
        ctx.fillStyle = this.ink('#F3F3F3'); ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = this.ink('#C9C9C9'); ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#8A8A8A'; ctx.font = "400 12px 'IBM Plex Sans', sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(im && im.__bad ? 'Image failed to load' : 'Loading image…', b.x + b.w / 2, b.y + b.h / 2);
      }
    }
    if (el.label && el.type !== 'text' && el.type !== 'frame') {
      ctx.fillStyle = this.ink(el.stroke || '#1e1e1e');
      ctx.font = '500 ' + (el.fontSize || 16) + "px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = String(el.label).split('\n');
      const lh = (el.fontSize || 16) * 1.25;
      lines.forEach((l, i) => ctx.fillText(l, b.x + b.w / 2, b.y + b.h / 2 + (i - (lines.length - 1) / 2) * lh));
    }
    ctx.restore();
  }

  roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.max(0, r || 0);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  overlay(ctx: CanvasRenderingContext2D) {
    const z = this.view.z, accent = ACCENT;
    const d = this.drag;
    if (d && d.mode === 'marquee') {
      const x = Math.min(d.a.x, d.b.x), y = Math.min(d.a.y, d.b.y), w = Math.abs(d.b.x - d.a.x), h = Math.abs(d.b.y - d.a.y);
      ctx.save(); ctx.fillStyle = accentAlpha(0.07); ctx.strokeStyle = accent; ctx.lineWidth = 1 / z;
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.restore();
    }
    const sel = this.state.sel.map((id) => this.byId(id)).filter((e): e is El => !!e);
    if (!sel.length) return;
    ctx.save();
    ctx.strokeStyle = accent; ctx.lineWidth = 1 / z;
    if (sel.length > 1) { const b = this.bbox(sel); ctx.setLineDash([4 / z, 3 / z]); ctx.strokeRect(b.x - 4 / z, b.y - 4 / z, b.w + 8 / z, b.h + 8 / z); ctx.setLineDash([]); }
    for (const el of sel) {
      const b = this.bbox([el]);
      ctx.setLineDash([4 / z, 3 / z]);
      ctx.strokeRect(b.x - 4 / z, b.y - 4 / z, b.w + 8 / z, b.h + 8 / z);
      ctx.setLineDash([]);
    }
    if (sel.length === 1) {
      const s = 4 / z;
      ctx.fillStyle = this.state.theme === 'dark' ? '#131417' : '#FFFFFF';
      for (const h of this.handles(sel[0])) { ctx.beginPath(); ctx.rect(h.x - s, h.y - s, s * 2, s * 2); ctx.fill(); ctx.stroke(); }
      for (const key of ['startBinding', 'endBinding'] as const) {
        const bid = sel[0][key];
        const t = bid ? this.byId(bid) : undefined;
        if (t) { const bb = this.box(t); ctx.setLineDash([3 / z, 3 / z]); ctx.strokeRect(bb.x - 3 / z, bb.y - 3 / z, bb.w + 6 / z, bb.h + 6 / z); ctx.setLineDash([]); }
      }
    }
    ctx.restore();
  }

  /* ---------- view ---------- */

  zoom(f: number) {
    const c = this.canvas;
    const z = Math.max(0.2, Math.min(4, this.view.z * f));
    if (c) { const cw = c.clientWidth / 2, ch = c.clientHeight / 2; const mx = cw / this.view.z + this.view.x, my = ch / this.view.z + this.view.y; this.view.x = mx - cw / z; this.view.y = my - ch / z; }
    this.view.z = z;
    this.setState((s) => ({ rev: s.rev + 1 }));
  }

  fit() {
    if (!this.els.length || !this.canvas) { this.view = { x: -40, y: -30, z: 1 }; this.setState((s) => ({ rev: s.rev + 1 })); return; }
    const b = this.bbox(this.els), pad = 60;
    const z = Math.max(0.2, Math.min(2, Math.min(this.canvas.clientWidth / (b.w + pad * 2), this.canvas.clientHeight / (b.h + pad * 2))));
    this.view = { z, x: b.x + b.w / 2 - this.canvas.clientWidth / (2 * z), y: b.y + b.h / 2 - this.canvas.clientHeight / (2 * z) };
    this.setState((s) => ({ rev: s.rev + 1 }));
    this.queueSave();
  }

  /* ---------- import / export ---------- */

  safeName(ext: string) { return (this.state.name || 'scene').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 48) + '.' + ext; }

  download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  esc(s: unknown) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  svgString(): string {
    const pad = 24, b = this.bbox(this.els);
    const W = Math.max(1, Math.round(b.w + pad * 2)), H = Math.max(1, Math.round(b.h + pad * 2));
    const ox = pad - b.x, oy = pad - b.y;
    const out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="100%" height="100%" fill="#FFFFFF"/><g font-family="IBM Plex Sans, sans-serif">'];
    const D = (el: El) => { const a = this.dashArr(el); return a.length ? ' stroke-dasharray="' + a.join(' ') + '" stroke-linecap="round"' : ''; };
    const A = (el: El) => D(el) + ' stroke="' + el.stroke + '" stroke-width="' + (el.sw || 2) + '" opacity="' + (el.opacity == null ? 1 : el.opacity) + '" fill="' + (el.fill && el.fill !== 'transparent' ? el.fill : 'none') + '" stroke-linejoin="round" stroke-linecap="round"';
    for (const el of this.els) {
      const bb = this.box(el);
      const x = bb.x + ox, y = bb.y + oy;
      if (el.type === 'rect') out.push('<rect x="' + x + '" y="' + y + '" width="' + bb.w + '" height="' + bb.h + '" rx="' + Math.min(8, bb.w / 4, bb.h / 4) + '" ' + A(el) + '/>');
      else if (el.type === 'ellipse') out.push('<ellipse cx="' + (x + bb.w / 2) + '" cy="' + (y + bb.h / 2) + '" rx="' + bb.w / 2 + '" ry="' + bb.h / 2 + '" ' + A(el) + '/>');
      else if (el.type === 'diamond') out.push('<polygon points="' + [[x + bb.w / 2, y], [x + bb.w, y + bb.h / 2], [x + bb.w / 2, y + bb.h], [x, y + bb.h / 2]].map((p) => p.join(',')).join(' ') + '" ' + A(el) + '/>');
      else if (el.type === 'triangle') out.push('<polygon points="' + this.triPts(el).map((q) => (q[0] + ox) + ',' + (q[1] + oy)).join(' ') + '" ' + A(el) + '/>');
      else if (el.type === 'line' || el.type === 'arrow') {
        const raw = this.linePts(el).map((q) => ({ x: q.x + ox, y: q.y + oy }));
        const p0 = raw[0], p1 = raw[raw.length - 1];
        out.push('<polyline points="' + raw.map((q) => Math.round(q.x * 100) / 100 + ',' + Math.round(q.y * 100) / 100).join(' ') + '" fill="none" ' + A(el) + '/>');
        const R = (v: number) => Math.round(v * 100) / 100;
        const svgHead = (kind: Head | undefined, tip: Point, ang: number) => {
          if (!kind || kind === 'none') return;
          const L = 10 + (el.sw || 2) * 1.6;
          if (kind === 'dot') { out.push('<circle cx="' + R(tip.x) + '" cy="' + R(tip.y) + '" r="' + Math.max(3, (el.sw || 2) * 1.6) + '" fill="' + el.stroke + '"/>'); return; }
          if (kind === 'bar') {
            const px = Math.cos(ang + Math.PI / 2) * L * 0.5, py = Math.sin(ang + Math.PI / 2) * L * 0.5;
            out.push('<line x1="' + R(tip.x - px) + '" y1="' + R(tip.y - py) + '" x2="' + R(tip.x + px) + '" y2="' + R(tip.y + py) + '" stroke="' + el.stroke + '" stroke-width="' + (el.sw || 2) + '" stroke-linecap="round"/>');
            return;
          }
          const q1 = [R(tip.x - L * Math.cos(ang - 0.42)), R(tip.y - L * Math.sin(ang - 0.42))];
          const q2 = [R(tip.x - L * Math.cos(ang + 0.42)), R(tip.y - L * Math.sin(ang + 0.42))];
          const tri = [q1, [R(tip.x), R(tip.y)], q2].map((q) => q.join(',')).join(' ');
          if (kind === 'triangle') out.push('<polygon points="' + tri + '" fill="' + el.stroke + '"/>');
          else out.push('<polyline points="' + tri + '" fill="none" stroke="' + el.stroke + '" stroke-width="' + (el.sw || 2) + '" stroke-linejoin="round" stroke-linecap="round"/>');
        };
        const prevQ = raw[raw.length - 2] || p0, secondQ = raw[1] || p1;
        svgHead(el.head == null ? (el.type === 'arrow' ? 'arrow' : 'none') : el.head, p1, Math.atan2(p1.y - prevQ.y, p1.x - prevQ.x));
        svgHead(el.tail || 'none', p0, Math.atan2(p0.y - secondQ.y, p0.x - secondQ.x));
      } else if (el.type === 'draw') {
        out.push('<polyline points="' + el.points!.map((q) => (el.x + q[0] + ox) + ',' + (el.y + q[1] + oy)).join(' ') + '" fill="none" stroke="' + el.stroke + '" stroke-width="' + (el.sw || 2) + '" opacity="' + (el.opacity == null ? 1 : el.opacity) + '" stroke-linejoin="round" stroke-linecap="round"/>');
      } else if (el.type === 'sticky') {
        out.push('<rect x="' + x + '" y="' + y + '" width="' + bb.w + '" height="' + bb.h + '" rx="2" fill="' + (el.fill && el.fill !== 'transparent' ? el.fill : '#FFF3C0') + '" stroke="rgba(0,0,0,0.10)" stroke-width="1" opacity="' + (el.opacity == null ? 1 : el.opacity) + '"/>');
      } else if (el.type === 'frame') {
        out.push('<rect x="' + x + '" y="' + y + '" width="' + bb.w + '" height="' + bb.h + '" rx="4" fill="none" stroke="' + (el.stroke || '#9A9A9A') + '" stroke-width="' + (el.sw || 2) + '" stroke-dasharray="' + (this.dashArr(el).join(' ') || '6 4') + '"/>');
        out.push('<text x="' + x + '" y="' + (y - 4) + '" font-size="12" fill="#8A8A8A" font-family="\'IBM Plex Sans\', sans-serif">' + this.esc(el.name || 'Frame') + '</text>');
      } else if (el.type === 'embed') {
        out.push('<rect x="' + x + '" y="' + y + '" width="' + bb.w + '" height="' + bb.h + '" rx="6" fill="#FFFFFF" stroke="#C9C9C9" stroke-width="1"/>');
        out.push('<text x="' + (x + 12) + '" y="' + (y + 24) + '" font-size="12" fill="#8A8A8A" font-family="\'IBM Plex Sans\', sans-serif">' + this.esc(el.src) + '</text>');
      } else if (el.type === 'image') {
        out.push('<image x="' + x + '" y="' + y + '" width="' + bb.w + '" height="' + bb.h + '" href="' + el.src + '" opacity="' + (el.opacity == null ? 1 : el.opacity) + '"/>');
      } else if (el.type === 'text') {
        String(el.text || '').split('\n').forEach((l, i) => out.push('<text x="' + x + '" y="' + (y + el.fontSize * (0.82 + i * 1.25)) + '" font-size="' + el.fontSize + '" fill="' + el.stroke + '" opacity="' + (el.opacity == null ? 1 : el.opacity) + '">' + this.esc(l) + '</text>'));
      }
      if (el.label && el.type !== 'text' && el.type !== 'frame') {
        const lines = String(el.label).split('\n'), lh = (el.fontSize || 16) * 1.25;
        lines.forEach((l, i) => out.push('<text x="' + (x + bb.w / 2) + '" y="' + (y + bb.h / 2 + (i - (lines.length - 1) / 2) * lh + (el.fontSize || 16) * 0.34) + '" font-size="' + (el.fontSize || 16) + '" font-weight="500" text-anchor="middle" fill="' + el.stroke + '">' + this.esc(l) + '</text>'));
      }
    }
    out.push('</g></svg>');
    return out.join('');
  }

  exportSvg() {
    if (!this.els.length) return this.toast('Nothing to export yet — draw something first.', 'bad');
    this.download(new Blob([this.svgString()], { type: 'image/svg+xml' }), this.safeName('svg'));
    this.toast('Exported ' + this.safeName('svg') + ' — flat vector, no app metadata.');
  }

  exportPng() {
    if (!this.els.length) return this.toast('Nothing to export yet — draw something first.', 'bad');
    this.exporting = true;
    const pad = 24, b = this.bbox(this.els), scale = 2;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((b.w + pad * 2) * scale));
    c.height = Math.max(1, Math.round((b.h + pad * 2) * scale));
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(scale, 0, 0, scale, (pad - b.x) * scale, (pad - b.y) * scale);
    this.paint(ctx, this.els);
    this.exporting = false;
    const name = this.safeName('png');
    c.toBlob((blob) => {
      if (!blob) return this.toast('The browser refused to encode that PNG. Try SVG.', 'bad');
      this.download(blob, name);
      this.toast('Exported ' + name + ' at 2× (' + c.width + '×' + c.height + ').');
    }, 'image/png');
  }

  exportJson() {
    const data = { type: 'slate-scene', version: 1, name: this.state.name || 'Untitled scene', elements: this.els };
    this.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), this.safeName('json'));
    this.toast('Exported ' + this.safeName('json') + ' — re-importable, your full backup format.');
  }
  /* ---------- excalidraw interop ---------- */

  exTypeMap: Record<string, ElType> = { rectangle: 'rect', ellipse: 'ellipse', diamond: 'diamond', arrow: 'arrow', line: 'line', freedraw: 'draw', text: 'text', image: 'image', frame: 'frame', embeddable: 'embed', magicframe: 'frame', iframe: 'embed' };

  palette = PALETTE;

  familyOf(color: string | undefined): PaletteFamily | null { return familyOf(color); }

  setColor(which: 'stroke' | 'fill', value: string) {
    const patch: Partial<StyleDefaults> = {};
    patch[which] = value;
    this.setStyle(patch);
  }

  applyHex(which: 'stroke' | 'fill', raw: string) {
    let v = String(raw || '').trim().toLowerCase();
    if (v === 'transparent') return this.setColor(which, 'transparent');
    if (v[0] !== '#') v = '#' + v;
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return this.toast('Enter a 3 or 6 digit hex code.', 'bad');
    this.setColor(which, v);
  }

  exColor(v: unknown, fallback: string): string {
    if (typeof v !== 'string') return fallback;
    const s = v.trim().toLowerCase();
    if (s === 'transparent') return 'transparent';
    if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7);
    if (/^rgba?\([\d.,\s%]+\)$/.test(s)) return s;
    return fallback;
  }

  /* One Excalidraw element -> one Slate element. Returns null for anything we cannot draw. */
  fromExcalidraw(x: any, idMap?: Map<string, string>): El | null {
    if (!x || typeof x !== 'object' || x.isDeleted) return null;
    const type = this.exTypeMap[x.type];
    if (!type) return null;
    const n = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
    const id = this.uid();
    if (idMap && x.id) idMap.set(x.id, id);
    const el: El = {
      id, type,
      x: n(x.x, 0), y: n(x.y, 0), w: n(x.width, 0), h: n(x.height, 0),
      stroke: this.exColor(x.strokeColor, '#1e1e1e'),
      fill: this.exColor(x.backgroundColor, 'transparent'),
      sw: Math.max(1, Math.min(6, n(x.strokeWidth, 2))),
      opacity: Math.max(0.1, Math.min(1, n(x.opacity, 100) / 100)),
      fontSize: Math.max(8, Math.min(96, n(x.fontSize, 16))),
      dash: x.strokeStyle === 'dashed' ? 'dashed' : x.strokeStyle === 'dotted' ? 'dotted' : 'solid',
      rough: Math.max(0, Math.min(2, n(x.roughness, 0))),
      label: '',
      curve: 'straight',
    };
    if (type === 'text') {
      el.text = typeof x.text === 'string' ? x.text : '';
      if (!el.text) return null;
      el.w = 0; el.h = 0;
    } else if (type === 'draw') {
      const pts: [number, number][] = Array.isArray(x.points) ? x.points.filter((p: unknown[]) => Array.isArray(p) && isFinite(p[0] as number) && isFinite(p[1] as number)).map((p: number[]) => [p[0], p[1]] as [number, number]) : [];
      if (pts.length < 2) return null;
      el.points = pts;
    } else if (type === 'line' || type === 'arrow') {
      const pts = Array.isArray(x.points) ? x.points : [];
      if (pts.length >= 2) {
        const a = pts[0], b = pts[pts.length - 1];
        el.x = n(x.x, 0) + n(a[0], 0); el.y = n(x.y, 0) + n(a[1], 0);
        el.w = n(b[0], 0) - n(a[0], 0); el.h = n(b[1], 0) - n(a[1], 0);
      }
      if (Math.hypot(el.w, el.h) < 1) return null;
      el.startBinding = null; el.endBinding = null;
      el.exStart = x.startBinding && x.startBinding.elementId;
      el.exEnd = x.endBinding && x.endBinding.elementId;
    } else if (type === 'embed') {
      const link = typeof x.link === 'string' ? x.link : '';
      if (!/^https:\/\//.test(link)) return null;
      el.src = link;
    } else if (type === 'image') {
      return null; // image bytes live in a separate files map we do not carry
    }
    if (el.w < 0) { el.x += el.w; el.w = -el.w; }
    if (el.h < 0) { el.y += el.h; el.h = -el.h; }
    return el;
  }

  /* A whole Excalidraw element array -> Slate elements, with bindings and container labels resolved. */
  convertExcalidraw(list: unknown): El[] {
    if (!Array.isArray(list)) return [];
    const idMap = new Map<string, string>();
    const out: El[] = [];
    for (const x of list) {
      const el = this.fromExcalidraw(x, idMap);
      if (el) out.push(el);
    }
    // bound text inside a shape becomes that shape's label, matching how Slate stores labels
    const containers = new Map<string, string>();
    for (let i = 0; i < list.length; i++) {
      const x = list[i];
      if (!x || x.type !== 'text' || !x.containerId) continue;
      containers.set(x.containerId, typeof x.text === 'string' ? x.text : '');
    }
    const byNew = new Map(out.map((e) => [e.id, e] as const));
    for (const [oldId, text] of containers) {
      const target = byNew.get(idMap.get(oldId) || '');
      if (target && text) {
        target.label = text;
        const src = list.find((y) => y && y.containerId === oldId) || {};
        const label = out.find((e) => e.type === 'text' && e.id === idMap.get(src.id));
        if (label) out.splice(out.indexOf(label), 1);
      }
    }
    for (const el of out) {
      if (el.exStart) el.startBinding = idMap.get(el.exStart) || null;
      if (el.exEnd) el.endBinding = idMap.get(el.exEnd) || null;
      delete el.exStart; delete el.exEnd;
    }
    return this.migrate(out);
  }

  /* ---------- libraries ---------- */

  async readLibs(): Promise<Library[]> {
    if (this.mem || !this.db) return this.memLibs || [];
    try {
      const rec = await this.tx<{ k: string; v: Library[] } | undefined>('meta', 'readonly', (s) => s.get('libs'));
      return (rec && Array.isArray(rec.v)) ? rec.v : [];
    } catch { return []; }
  }

  async writeLibs(libs: Library[]) {
    this.memLibs = libs;
    if (this.mem || !this.db) return;
    try { await this.tx('meta', 'readwrite', (s) => s.put({ k: 'libs', v: libs })); } catch { /* non-fatal */ }
  }

  async loadLibs() {
    const libs = await this.readLibs();
    this.setState({ libs });
  }

  parseLibrary(data: any, fallbackName: string): Library | null {
    let raw: { name: string; elements: unknown }[] = [];
    if (Array.isArray(data.libraryItems)) {
      raw = data.libraryItems.map((it: any) => ({
        name: (it && typeof it.name === 'string' && it.name.trim()) || '',
        elements: (it && it.elements) || [],
      }));
    } else if (Array.isArray(data.library)) {
      raw = data.library.map((els: unknown) => ({ name: '', elements: Array.isArray(els) ? els : [] }));
    }
    const items: LibItem[] = [];
    for (const it of raw) {
      const els = this.convertExcalidraw(it.elements);
      if (!els.length) continue;
      const b = this.bbox(els);
      const norm = els.map((e) => Object.assign({}, e, { x: e.x - b.x, y: e.y - b.y }));
      items.push({ id: this.uid(), name: it.name || 'Item ' + (items.length + 1), elements: norm, w: b.w, h: b.h });
      if (items.length >= 300) break;
    }
    if (!items.length) return null;
    return { id: this.uid(), name: fallbackName, items, addedAt: Date.now() };
  }

  async installLibrary(text: string, fallbackName: string) {
    let data: any;
    try { data = JSON.parse(text); } catch { return this.toast('Not valid JSON — nothing was installed.', 'bad'); }
    if (!data || typeof data !== 'object' || (data.type && data.type !== 'excalidrawlib')) return this.toast('That is not an Excalidraw library file.', 'bad');
    const lib = this.parseLibrary(data, fallbackName);
    if (!lib) return this.toast('No usable items in that library.', 'bad');
    const libs = (await this.readLibs()).filter((l) => l.name !== lib.name).concat([lib]);
    await this.writeLibs(libs);
    this.setState({ libs, libOpen: true });
    this.toast('Installed “' + lib.name + '” — ' + lib.items.length + ' item' + (lib.items.length === 1 ? '' : 's') + '.');
  }

  importLibFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { input.value = ''; return this.toast('That library is larger than 12 MB — refusing to parse it.', 'bad'); }
    const r = new FileReader();
    r.onerror = () => { input.value = ''; this.toast('Could not read that file.', 'bad'); };
    r.onload = () => {
      input.value = '';
      this.installLibrary(String(r.result), file.name.replace(/\.excalidrawlib$/i, '').slice(0, 60) || 'Library');
    };
    r.readAsText(file);
  }

  async removeLib(id: string) {
    const libs = (await this.readLibs()).filter((l) => l.id !== id);
    await this.writeLibs(libs);
    this.setState({ libs });
  }

  placeLibItem(libId: string, itemId: string) {
    const lib = (this.state.libs || []).find((l) => l.id === libId);
    const item = lib && lib.items.find((i) => i.id === itemId);
    if (!item) return;
    const c = this.viewCentre();
    const idMap = new Map<string, string>();
    const copy = item.elements.map((e) => {
      const id = this.uid();
      idMap.set(e.id, id);
      return Object.assign({}, e, { id, x: e.x + c.x - item.w / 2, y: e.y + c.y - item.h / 2 });
    });
    for (const e of copy) {
      if (e.startBinding) e.startBinding = idMap.get(e.startBinding) || null;
      if (e.endBinding) e.endBinding = idMap.get(e.endBinding) || null;
    }
    this.push();
    this.els = this.els.concat(copy);
    this.setState((s) => ({ sel: copy.map((e) => e.id), rev: s.rev + 1, tool: 'v', live: 'Placed ' + item.name }));
    this.queueSave();
  }

  libThumb(item: LibItem): string {
    this.exporting = true;
    try {
      const W = 96, H = 96, pad = 8, scale = 2;
      const c = document.createElement('canvas');
      c.width = W * scale; c.height = H * scale;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
      const z = Math.min((W - pad * 2) / (item.w || 1), (H - pad * 2) / (item.h || 1), 2);
      ctx.setTransform(z * scale, 0, 0, z * scale, ((W - item.w * z) / 2) * scale, ((H - item.h * z) / 2) * scale);
      this.paint(ctx, item.elements);
      this.exporting = false;
      return c.toDataURL('image/png');
    } catch { this.exporting = false; return ''; }
  }

  importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { input.value = ''; return this.toast('That file is larger than 8 MB — refusing to parse it.', 'bad'); }
    const r = new FileReader();
    r.onerror = () => { input.value = ''; this.toast('Could not read that file.', 'bad'); };
    r.onload = () => {
      input.value = '';
      let data: any;
      try { data = JSON.parse(String(r.result)); } catch { return this.toast('Not valid JSON — nothing was imported.', 'bad'); }
      if (data && data.type === 'excalidrawlib') return this.installLibrary(String(r.result), file.name.replace(/\.(excalidrawlib|json)$/i, '').slice(0, 60) || 'Library');
      if (!data || typeof data !== 'object' || !Array.isArray(data.elements)) return this.toast('Missing an “elements” array — this does not look like a Slate scene.', 'bad');
      if (data.elements.length > 5000) return this.toast('That scene has more than 5000 elements — refusing to import.', 'bad');
      const total = data.elements.length;
      const excal = data.type === 'excalidraw' || data.elements.some((x: any) => x && (x.type === 'rectangle' || x.type === 'freedraw' || typeof x.strokeColor === 'string'));
      const ok = excal
        ? this.convertExcalidraw(data.elements)
        : this.migrate(data.elements).map((el) => Object.assign({}, el, { id: this.uid() }));
      if (!ok.length) return this.toast('All ' + total + ' elements failed validation — nothing was imported.', 'bad');
      const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 60) : file.name.replace(/\.(json|excalidraw)$/i, '');
      this.newScene(ok, name).then(() => {
        this.fit();
        const dropped = total - ok.length;
        this.toast('Imported ' + ok.length + ' element' + (ok.length === 1 ? '' : 's') + ' into “' + name + '”' + (dropped ? ' — skipped ' + dropped + ' invalid one' + (dropped === 1 ? '' : 's') + '.' : '.'));
      });
    };
    r.readAsText(file);
  }

  /* ---------- sample data ---------- */

  sampleScene(): Scene {
    const S = (type: ElType, x: number, y: number, w: number, h: number, label?: string, fill?: string): El => ({ id: this.uid(), type, x, y, w, h, label: label || '', stroke: '#1e1e1e', fill: fill || 'transparent', sw: 2, opacity: 1, fontSize: 16, dash: 'solid', rough: 0, curve: 'straight' });
    const T = (x: number, y: number, text: string, fontSize: number, stroke?: string): El => ({ id: this.uid(), type: 'text', x, y, text, w: 0, h: 0, fontSize: fontSize, stroke: stroke || '#1e1e1e', fill: 'transparent', sw: 2, opacity: 1, label: '', dash: 'solid', rough: 0, curve: 'straight' });
    const start = S('ellipse', 60, 170, 130, 66, 'Start', 'transparent');
    const signup = S('rect', 250, 170, 165, 66, 'Sign up', '#a5d8ff');
    const verify = S('rect', 475, 170, 165, 66, 'Verify email', '#a5d8ff');
    const gate = S('diamond', 700, 152, 190, 102, 'Verified?', '#ffec99');
    const resend = S('rect', 475, 320, 165, 66, 'Resend link', 'transparent');
    const tour = S('rect', 703, 320, 184, 66, 'Welcome tour', '#a5d8ff');
    const home = S('ellipse', 730, 450, 130, 66, 'Dashboard', '#b2f2bb');
    const A = (a: El, b: El): El => ({ id: this.uid(), type: 'arrow', x: 0, y: 0, w: 0, h: 0, startBinding: a.id, endBinding: b.id, stroke: '#1e1e1e', fill: 'transparent', sw: 2, opacity: 1, fontSize: 14, label: '', dash: 'solid', rough: 0, curve: 'straight' });
    const els = [
      T(60, 60, 'Sample scene — onboarding flow', 30),
      T(60, 106, 'Sample data, shipped with the app. Drag a box, grab a handle to resize, press A and drag between two boxes to connect.', 14, '#5C5C5C'),
      start, signup, verify, gate, resend, tour, home,
      A(start, signup), A(signup, verify), A(verify, gate), A(gate, tour), A(tour, home), A(gate, resend), A(resend, verify),
      T(908, 196, 'yes', 14, '#5C5C5C'), T(600, 250, 'no', 14, '#5C5C5C'),
    ];
    return { id: this.uid(), name: 'Sample — onboarding flow', elements: els, view: { x: 0, y: 20, z: 1 }, updatedAt: Date.now(), isSample: true };
  }

  starter() {
    this.push();
    const st = this.state.style;
    const mk = (x: number, label: string): El => ({ id: this.uid(), type: 'rect', x, y: 200, w: 160, h: 74, label, stroke: st.stroke, fill: '#a5d8ff', sw: st.sw, opacity: 1, fontSize: 16, dash: 'solid', rough: 0, curve: 'straight' });
    const a = mk(120, 'First step'), b = mk(380, 'Second step');
    this.els = this.els.concat([a, b, { id: this.uid(), type: 'arrow', x: 0, y: 0, w: 0, h: 0, startBinding: a.id, endBinding: b.id, stroke: '#1e1e1e', fill: 'transparent', sw: 2, opacity: 1, fontSize: 14, label: '', dash: 'solid', rough: 0, curve: 'straight' }]);
    this.setState((s) => ({ sel: [], rev: s.rev + 1, live: 'Inserted two connected boxes' }));
    this.queueSave();
    this.toast('Try dragging a box — the arrow follows it. Double-click a box to relabel it.');
  }

  /* ---------- misc ---------- */

  toast(msg: string, kind?: 'ok' | 'bad') {
    clearTimeout(this.toastT);
    this.setState({ toast: msg, toastKind: kind || 'ok', live: msg });
    this.toastT = setTimeout(() => this.setState({ toast: null }), kind === 'bad' ? 6000 : 4000);
  }

  rename(v: string) {
    const t = v.slice(0, 60);
    const err = !t.trim() ? 'Scene name cannot be empty.' : t.length >= 60 ? 'Maximum 60 characters.' : '';
    this.setState((s) => ({ name: t, nameError: err, scenes: s.scenes.map((x) => (x.id === s.sceneId ? Object.assign({}, x, { name: t.trim() || 'Untitled scene' }) : x)) }));
    if (!err) this.queueSave();
  }

  async dropSample() {
    const id = this.state.sceneId;
    const others = this.state.scenes.filter((s) => s.id !== id);
    try { if (this.db) await this.tx('scenes', 'readwrite', (s) => s.delete(id)); } catch { /* ignore */ }
    this.setState({ scenes: others, isSample: false });
    if (others.length) { this.setState({ sceneId: '' }, () => this.loadScene(others[0].id)); }
    else await this.newScene([], 'Untitled scene');
    this.toast('Sample data deleted. Nothing else was touched.');
  }

  ago(t: number): string {
    const d = Date.now() - t;
    if (d < 60000) return 'just now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
    return Math.floor(d / 86400000) + 'd ago';
  }
  /* ---------- template inputs ---------- */

  renderVals() {
    const s = this.state, accent = ACCENT;
    const dark = s.theme === 'dark';
    const tools: Record<string, string> = { v: 'Select', r: 'Rectangle', o: 'Ellipse', d: 'Diamond', a: 'Arrow', l: 'Line', p: 'Freedraw', t: 'Text', s: 'Sticky note', f: 'Frame', e: 'Eraser', k: 'Laser pointer', b: 'Bucket fill', h: 'Pan' };
    const tb: Record<string, { p: boolean; bg: string; fg: string; on: () => void }> = {};
    Object.keys(tools).forEach((k) => {
      const on = s.tool === k;
      tb[k] = { p: on, bg: on ? accent : 'transparent', fg: on ? '#FFFFFF' : 'var(--muted)', on: () => this.setState({ tool: k as Tool, live: 'Tool: ' + tools[k] }) };
    });
    tb.i = { p: false, bg: 'transparent', fg: 'var(--muted)', on: () => this.pickImage() };
    const selEls = s.sel.map((id) => this.byId(id)).filter((e): e is El => !!e);
    const cur0 = selEls[0];
    const eff = cur0 ? { stroke: cur0.stroke, fill: cur0.fill, sw: cur0.sw, opacity: cur0.opacity == null ? 1 : cur0.opacity, fontSize: cur0.fontSize, dash: cur0.dash || 'solid', rough: cur0.rough || 0 } : s.style;
    const toolType: Partial<Record<Tool, ElType>> = { r: 'rect', o: 'ellipse', d: 'diamond', a: 'arrow', l: 'line', p: 'draw', t: 'text', s: 'sticky', f: 'frame' };
    const allTypes: ElType[] = ['rect', 'ellipse', 'diamond', 'triangle', 'line', 'arrow', 'draw', 'text', 'sticky', 'frame'];
    const capTypes: ElType[] = selEls.length ? selEls.map((e) => e.type) : (toolType[s.tool] ? [toolType[s.tool]!] : allTypes);
    const can = (key: string) => capTypes.some((t) => this.caps(t).indexOf(key) >= 0);
    const picker = (key: 'stroke' | 'fill') => {
      const cur = String((eff as Record<string, unknown>)[key] || '').toLowerCase();
      const fam = this.familyOf(cur);
      return {
        open: s.picker === key,
        toggle: () => this.setState((p) => ({ picker: p.picker === key ? null : key, hexDraft: null })),
        current: cur === 'transparent' ? '#FFFFFF' : cur,
        currentGlyph: cur === 'transparent' ? '∅' : '',
        currentLabel: cur === 'transparent' ? 'transparent' : cur.replace('#', ''),
        hexValue: s.picker === key && s.hexDraft != null ? s.hexDraft : (cur === 'transparent' ? 'transparent' : cur.replace('#', '')),
        hexLabel: 'Hex code for ' + (key === 'stroke' ? 'stroke' : 'fill'),
        // apply silently while typing; only Enter reports a bad code
        onHex: (ev: React.ChangeEvent<HTMLInputElement>) => {
          const v = ev.target.value;
          this.setState({ hexDraft: v });
          const t = v.trim().toLowerCase();
          if (t === 'transparent' || /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.test(t)) this.setColor(key, t === 'transparent' ? 'transparent' : (t[0] === '#' ? t : '#' + t));
        },
        onHexKey: (ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') { ev.preventDefault(); this.setState({ hexDraft: null }); this.applyHex(key, (ev.target as HTMLInputElement).value); } },
        families: this.palette.map((f) => {
          const v = f.shades.length > 1 ? f.shades[key === 'stroke' ? 3 : 0] : f.shades[0];
          const active = fam === f;
          return {
            v: v === 'transparent' ? '#FFFFFF' : v,
            glyph: v === 'transparent' ? '∅' : '',
            label: f.label, hint: f.hint,
            ring: active ? accent : 'var(--line)',
            on: () => { this.setState({ hexDraft: null }); this.setColor(key, v); },
          };
        }),
        hasShades: !!(fam && fam.shades.length > 1),
        noShades: !(fam && fam.shades.length > 1),
        shades: (fam && fam.shades.length > 1 ? fam.shades : []).map((v, i) => ({
          v, label: fam!.label + ' ' + (i + 1),
          ring: v === cur ? accent : 'var(--line)',
          fg: i >= 3 ? '#FFFFFF' : '#495057',
          n: String(i + 1),
          on: () => this.setColor(key, v),
        })),
      };
    };
    const headsOf = (key: 'head' | 'tail') => {
      const dflt = key === 'head' ? (capTypes.indexOf('arrow') >= 0 ? 'arrow' : 'none') : 'none';
      const cur = selEls.length ? (selEls[0][key] == null ? dflt : selEls[0][key]) : (s.style[key] == null ? dflt : s.style[key]);
      return (['none', 'arrow', 'triangle', 'dot', 'bar'] as Head[]).map((v) => ({
        v, label: v === 'none' ? 'None' : v[0].toUpperCase() + v.slice(1),
        p: cur === v, ring: cur === v ? accent : 'var(--line-2)',
        bg: cur === v ? 'var(--soft)' : 'var(--panel-2)', fg: cur === v ? 'var(--text-2)' : 'var(--muted)',
        on: () => { const patch: Partial<StyleDefaults> = {}; patch[key] = v; this.setStyle(patch); },
      }));
    };
    const curveOf = () => {
      const cur = (selEls.length ? selEls[0].curve : s.style.curve) || 'straight';
      return (['straight', 'curved', 'elbow'] as Curve[]).map((v) => ({
        v, label: v[0].toUpperCase() + v.slice(1),
        p: cur === v, ring: cur === v ? accent : 'var(--line-2)',
        bg: cur === v ? 'var(--soft)' : 'var(--panel-2)', fg: cur === v ? 'var(--text-2)' : 'var(--muted)',
        on: () => this.setStyle({ curve: v }),
      }));
    };
    const swatch = (v: string, label: string, key: 'stroke' | 'fill') => ({
      v: v === 'transparent' ? '#FFFFFF' : v, label: label, glyph: v === 'transparent' ? '∅' : '',
      p: (eff as Record<string, unknown>)[key] === v, ring: (eff as Record<string, unknown>)[key] === v ? accent : 'var(--line)',
      on: () => this.setStyle(key === 'stroke' ? { stroke: v } : { fill: v }),
    });
    const seg = (label: string, val: string | number, key: keyof StyleDefaults) => ({
      label, p: (eff as Record<string, unknown>)[key] === val, ring: (eff as Record<string, unknown>)[key] === val ? accent : 'var(--line-2)',
      bg: (eff as Record<string, unknown>)[key] === val ? 'var(--soft)' : 'var(--panel-2)', fg: (eff as Record<string, unknown>)[key] === val ? 'var(--text-2)' : 'var(--muted)',
      on: () => { const patch: Record<string, unknown> = {}; patch[key] = val; this.setStyle(patch as Partial<StyleDefaults>); },
    });
    const saveMap: Record<string, [string, string]> = {
      idle: ['var(--line-2)', 'ready'], saving: ['#B67D11', s.auth ? 'syncing…' : 'saving…'], ok: ['#2E844A', s.auth ? 'synced' : 'saved locally'],
      fail: ['#B3261E', 'save failed'], mem: ['#B67D11', 'not saved — memory only'],
    };
    const sv = saveMap[s.save] || saveMap.idle;
    const needle = String(s.q || '').trim().toLowerCase();
    const gShown = needle ? s.gallery.filter((x) => String(x.name || '').toLowerCase().indexOf(needle) >= 0) : s.gallery;
    return {
      scenesOpen: !!s.scenesOpen, scenesTurn: s.scenesOpen ? '0deg' : '-90deg', scenesLabel: s.scenesOpen ? 'Collapse scenes' : 'Expand scenes',
      sidebarOpen: !!s.sidebarOpen,
      sidebarW: s.sidebarOpen ? SIDEBAR_W : 0,
      sidebarLabel: s.sidebarOpen ? 'Hide scenes and style panel' : 'Show scenes and style panel',
      sidebarTurn: s.sidebarOpen ? '0deg' : '180deg',
      menuOpen: !!s.menuOpen, menuBg: s.menuOpen ? 'var(--soft)' : 'var(--panel)',
      signedIn: !!s.auth, signedOut: !s.auth,
      badgeLabel: s.auth ? (s.syncState === 'syncing' ? 'syncing' : 'synced') : 'local only',
      acctName: s.auth ? s.auth.name : '',
      acctEmail: s.auth ? s.auth.email : '',
      acctInitial: s.auth ? String(s.auth.name || s.auth.email).trim().charAt(0).toUpperCase() : '',
      syncDot: s.syncState === 'syncing' ? '#B67D11' : '#2E844A',
      syncLabel: s.syncState === 'syncing' ? 'Syncing your gallery' : 'Synced',
      syncMeta: s.syncState === 'syncing' ? 'in progress' : 'just now',
      authOpen: !!s.authOpen, authBusy: !!s.authBusy,
      authOp: s.authBusy ? 0.55 : 1,
      authCta: s.authBusy ? 'Opening Google…' : 'Continue with Google',
      uploadTitle: s.scenes.length
        ? (s.scenes.length === 1 ? 'One scene on this device' : s.scenes.length + ' scenes on this device')
        : 'Nothing on this device yet',
      uploadBody: s.scenes.length
        ? 'They upload to your gallery the first time you sign in, and this browser keeps a cached copy.'
        : 'Anything you draw from here on saves straight to your gallery.',
      accountOpen: !!s.accountOpen,
      signOutIdle: !s.signOutAsk, signOutAsk: !!s.signOutAsk,
      autoSync: !!s.autoSync, keepLocal: !!s.keepLocal,
      autoTrack: s.autoSync ? accent : 'var(--line-2)',
      autoJustify: s.autoSync ? 'flex-end' : 'flex-start',
      cacheTrack: s.keepLocal ? accent : 'var(--line-2)',
      cacheJustify: s.keepLocal ? 'flex-end' : 'flex-start',
      menuViewLabel: s.view === 'gallery' ? 'Back to canvas' : 'Gallery',
      menuThemeLabel: dark ? 'Light mode' : 'Dark mode',
      menu: {
        view: () => { this.setState({ menuOpen: false }); if (s.view === 'gallery') this.setState({ view: 'canvas' }, () => this.draw()); else this.openGallery(); },
        lib: () => this.setState((p) => ({ menuOpen: false, libOpen: !p.libOpen })),
        svg: () => { this.setState({ menuOpen: false }); this.exportSvg(); },
        png: () => { this.setState({ menuOpen: false }); this.exportPng(); },
        json: () => { this.setState({ menuOpen: false }); this.exportJson(); },
        import: (ev: React.ChangeEvent<HTMLInputElement>) => { this.setState({ menuOpen: false }); this.importFile(ev); },
        theme: () => { this.setState({ menuOpen: false }); this.toggleTheme(); },
        signIn: () => this.setState({ menuOpen: false, authOpen: true, authBusy: false }),
        account: () => this.setState({ menuOpen: false, accountOpen: true, signOutAsk: false }),
      },
      theme: s.theme, isDark: dark, isLight: !dark, themeLabel: dark ? 'Switch to light mode' : 'Switch to dark mode',
      loading: s.loading, dbError: s.dbError, nameError: s.nameError, name: s.name, isSample: s.isSample,
      showEmpty: !s.loading && this.els.length === 0 && !s.editing,
      editing: !!s.editing, help: s.help, toast: s.toast,
      toastDot: s.toastKind === 'bad' ? '#FE8F7D' : '#7BD4A0',
      cursor: s.tool === 'h' ? 'grab' : s.tool === 'v' ? 'default' : s.tool === 'e' ? 'cell' : s.tool === 'b' ? 'copy' : 'crosshair',
      tb, hasSel: selEls.length > 0,
      selLabel: selEls.length === 1 ? '1 element selected — press Enter to add a label' : selEls.length + ' elements selected',
      strokes: ([['#1e1e1e', 'Black'], ['#e03131', 'Red'], ['#2f9e44', 'Green'], ['#1971c2', 'Blue'], ['#f08c00', 'Orange']] as [string, string][]).map(([v, l]) => swatch(v, l + ' stroke', 'stroke')),
      fills: ([['transparent', 'Transparent'], ['#ffc9c9', 'Red'], ['#b2f2bb', 'Green'], ['#a5d8ff', 'Blue'], ['#ffec99', 'Yellow']] as [string, string][]).map(([v, l]) => swatch(v, l, 'fill')),
      sw: { thin: seg('Thin', 1, 'sw'), med: seg('Medium', 2, 'sw'), bold: seg('Bold', 4, 'sw') },
      dsh: { solid: seg('Solid', 'solid', 'dash'), dashed: seg('Dashed', 'dashed', 'dash'), dotted: seg('Dotted', 'dotted', 'dash') },
      rgh: { clean: seg('Clean', 0, 'rough'), rough: seg('Rough', 1, 'rough'), sloppy: seg('Sloppy', 2, 'rough') },
      sizes: [seg('S', 14, 'fontSize'), seg('M', 20, 'fontSize'), seg('L', 30, 'fontSize')],
      canStroke: can('stroke'), canFill: can('fill'), canSw: can('sw'), canDash: can('dash'), canRough: can('rough'), canFont: can('fontSize'),
      strokeLabel: capTypes.every((t) => t === 'text' || t === 'sticky') ? 'Text colour' : 'Stroke',
      strokePick: picker('stroke'), fillPick: picker('fill'),
      penOpen: s.tool === 'p',
      penFree: { p: s.drawMode !== 'shape', bg: s.drawMode !== 'shape' ? 'var(--soft)' : 'var(--panel-2)', ring: s.drawMode !== 'shape' ? accent : 'var(--line)', fg: s.drawMode !== 'shape' ? 'var(--text-2)' : 'var(--muted)', on: () => this.setState({ drawMode: 'free' }) },
      penShape: { p: s.drawMode === 'shape', bg: s.drawMode === 'shape' ? 'var(--soft)' : 'var(--panel-2)', ring: s.drawMode === 'shape' ? accent : 'var(--line)', fg: s.drawMode === 'shape' ? 'var(--text-2)' : 'var(--muted)', on: () => this.setState({ drawMode: 'shape' }) },
      canArrow: can('heads'), canCurve: can('curve'),
      tails: headsOf('tail'), heads: headsOf('head'), curves: curveOf(),
      canToShape: selEls.some((e) => e.type === 'draw'),
      libOpen: !!s.libOpen,
      libEmpty: !(s.libs || []).length,
      libs: (s.libs || []).map((l) => ({
        id: l.id, name: l.name, count: l.items.length + ' items',
        remove: () => this.removeLib(l.id),
        removeLabel: 'Remove ' + l.name,
        items: l.items.map((it) => ({
          id: it.id, name: it.name, thumb: this.libThumb(it),
          place: () => this.placeLibItem(l.id, it.id),
        })),
      })),
      embedOpen: !!s.embedOpen, embedUrl: s.embedUrl || '',
      mermaidOpen: !!s.mermaidOpen, mermaidSrc: s.mermaidSrc,
      noUndo: !this.hist.length, noRedo: !this.future.length,
      undoFg: this.hist.length ? 'var(--text)' : 'var(--muted-3)', redoFg: this.future.length ? 'var(--text)' : 'var(--muted-3)',
      undoOp: this.hist.length ? 1 : 0.5, redoOp: this.future.length ? 1 : 0.5,
      opacityVal: Math.round(eff.opacity * 100), opacityLabel: Math.round(eff.opacity * 100) + '%',
      styleTitle: selEls.length ? 'Selection' : 'Defaults for new shapes',
      sceneList: s.scenes.map((x) => ({
        name: x.name, id: x.id, cur: x.id === s.sceneId ? 'true' : 'false',
        bg: x.id === s.sceneId ? 'var(--soft)' : 'transparent', fw: x.id === s.sceneId ? '600' : '400',
        meta: x.count + (x.count === 1 ? ' item · ' : ' items · ') + this.ago(x.updatedAt) + (x.isSample ? ' · sample' : ''),
        dupLabel: 'Duplicate ' + x.name, delLabel: 'Delete ' + x.name,
        open: () => this.loadScene(x.id), dup: () => this.dupScene(x.id), del: () => this.delScene(x.id),
      })),
      isGallery: s.view === 'gallery',
      backLabel: s.name ? 'Back to ' + s.name : 'Back to canvas',
      q: s.q,
      galleryMeta: gShown.length === s.gallery.length
        ? s.gallery.length + (s.gallery.length === 1 ? ' scene' : ' scenes') + (s.auth ? ' in your cloud gallery' : ' saved in this browser')
        : gShown.length + ' of ' + s.gallery.length + ' scenes match “' + s.q + '”',
      galleryEmpty: gShown.length === 0,
      galleryEmptyTitle: s.gallery.length ? 'No scenes match that search' : 'No saved scenes yet',
      galleryEmptyBody: s.gallery.length
        ? 'Clear the search box to see all ' + s.gallery.length + ' scenes.'
        : 'Scenes are saved automatically as you draw. Start one and it will show up here.',
      gallery: gShown.map((x) => ({
        id: x.id, name: x.name, thumb: x.thumb, hasThumb: !!x.thumb, blank: !x.thumb,
        alt: 'Preview of ' + x.name, badge: x.isSample,
        ring: x.id === s.sceneId ? 'var(--soft-2)' : 'var(--line)',
        meta: x.count + (x.count === 1 ? ' item · ' : ' items · ') + this.ago(x.updatedAt),
        openLabel: 'Open ' + x.name, dupLabel: 'Duplicate ' + x.name,
        jsonLabel: 'Export ' + x.name + ' as JSON', delLabel: 'Delete ' + x.name,
        open: () => this.loadScene(x.id), dup: () => this.dupScene(x.id),
        json: () => this.exportSceneJson(x.id), del: () => this.delScene(x.id),
      })),
      zoomLabel: Math.round(this.view.z * 100) + '%',
      countLabel: this.els.length + (this.els.length === 1 ? ' element' : ' elements') + (s.sel.length ? ' · ' + s.sel.length + ' selected' : ''),
      saveDot: sv[0], saveLabel: sv[1], live: s.live,
      onRename: (e: React.ChangeEvent<HTMLInputElement>) => this.rename(e.target.value),
      wrapRef: this.wrapRef, canvasRef: this.canvasRef, editRef: this.editRef, embedLayerRef: this.embedLayerRef,
      googleBtnRef: this.googleBtnRef,
      googleConfigured: cloudConfigured(),
      keys: [
        { what: 'Select / move', key: 'V' }, { what: 'Rectangle', key: 'R' },
        { what: 'Ellipse', key: 'O' }, { what: 'Diamond', key: 'D' },
        { what: 'Arrow (connects)', key: 'A' }, { what: 'Line', key: 'L' },
        { what: 'Freedraw', key: 'P' }, { what: 'Text', key: 'T' },
        { what: 'Sticky note', key: 'S' }, { what: 'Frame', key: 'F' },
        { what: 'Eraser', key: 'E' }, { what: 'Place image', key: 'I' },
        { what: 'Laser pointer', key: 'K' }, { what: 'Bucket fill', key: 'B' },
        { what: 'Draw to shape', key: '⇧X' },
        { what: 'Dark mode', key: '⌥⇧D' },
        { what: 'Pan', key: 'H / space-drag' }, { what: 'Zoom', key: '⌘ + wheel' },
        { what: 'Edit label', key: 'Enter / double-click' }, { what: 'Finish text', key: 'Esc' },
        { what: 'Delete', key: 'Del' }, { what: 'Duplicate', key: '⌘D' },
        { what: 'Select all', key: '⌘A' }, { what: 'Undo / redo', key: '⌘Z / ⇧⌘Z' },
        { what: 'Nudge / by 10', key: 'Arrows / ⇧arrows' }, { what: 'Export SVG', key: '⌘E' },
      ],
      act: {
        undo: () => this.undo(), redo: () => this.redo(),
        embed: () => this.setState({ embedOpen: true, mermaidOpen: false }),
        embedClose: () => this.setState({ embedOpen: false }),
        embedUrl: (ev: React.ChangeEvent<HTMLInputElement>) => this.setState({ embedUrl: ev.target.value }),
        embedKey: (ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') { ev.preventDefault(); this.addEmbed((ev.target as HTMLInputElement).value); } },
        embedAdd: () => this.addEmbed(this.state.embedUrl),
        mermaid: () => this.setState({ mermaidOpen: true, embedOpen: false }),
        mermaidClose: () => this.setState({ mermaidOpen: false }),
        mermaidSrc: (ev: React.ChangeEvent<HTMLTextAreaElement>) => this.setState({ mermaidSrc: ev.target.value }),
        mermaidGo: () => this.mermaid(this.state.mermaidSrc),
        toShape: () => this.toShape(),
        lib: () => this.setState((p) => ({ libOpen: !p.libOpen })),
        libClose: () => this.setState({ libOpen: false }),
        theme: () => this.toggleTheme(),
        menu: () => this.setState((p) => ({ menuOpen: !p.menuOpen })),
        menuClose: () => this.setState({ menuOpen: false }),
        toCanvas: () => this.setState({ view: 'canvas' }, () => this.draw()),
        signIn: () => this.setState({ authOpen: true, authBusy: false }),
        google: () => this.googleClick(),
        authClose: () => { this.setState({ authOpen: false, authBusy: false }); },
        account: () => this.setState({ accountOpen: true, signOutAsk: false }),
        accountClose: () => this.setState({ accountOpen: false, signOutAsk: false }),
        toggleAuto: () => this.setState((p) => { writeStoredAuth({ autoSync: !p.autoSync }); return { autoSync: !p.autoSync }; }),
        toggleCache: () => this.toggleCache(),
        askSignOut: () => this.setState({ signOutAsk: true }),
        cancelSignOut: () => this.setState({ signOutAsk: false }),
        signOut: () => this.signOut(),
        scenes: () => this.setState((p) => ({ scenesOpen: !p.scenesOpen })),
        sidebar: () => this.setState((p) => {
          const next = !p.sidebarOpen;
          try { localStorage.setItem('slate.sidebar', next ? 'open' : 'closed'); } catch { /* storage blocked */ }
          return { sidebarOpen: next };
        }),
        libImport: (ev: React.ChangeEvent<HTMLInputElement>) => this.importLibFile(ev),
        svg: () => this.exportSvg(), png: () => this.exportPng(), json: () => this.exportJson(),
        import: (e: React.ChangeEvent<HTMLInputElement>) => this.importFile(e), help: () => this.setState((p) => ({ help: !p.help })),
        newScene: () => this.newScene([], 'Untitled scene'),
        dropSample: () => this.dropSample(), starter: () => this.starter(),
        del: () => this.del(), dup: () => this.dup(), front: () => this.order(true), back: () => this.order(false),
        opacity: (e: React.ChangeEvent<HTMLInputElement>) => this.setStyle({ opacity: Number(e.target.value) / 100 }),
        zoomIn: () => this.zoom(1.2), zoomOut: () => this.zoom(1 / 1.2),
        zoomReset: () => { this.view.z = 1; this.setState((p) => ({ rev: p.rev + 1 })); }, fit: () => this.fit(),
        editChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => this.setState((p) => ({ editing: Object.assign({}, p.editing, { value: e.target.value }) as Editing })),
        editCommit: () => this.commitEdit(),
        showCanvas: () => this.setState({ view: 'canvas' }, () => this.draw()),
        showGallery: () => this.openGallery(),
        search: (e: React.ChangeEvent<HTMLInputElement>) => this.setState({ q: e.target.value.slice(0, 60) }),
        newFromGallery: () => this.newScene([], 'Untitled scene'),
      },
    };
  }

  toggleCache() {
    const next = !this.state.keepLocal;
    writeStoredAuth({ keepLocal: next });
    this.setState({ keepLocal: next }, () => {
      if (!this.state.auth) return;
      if (!next) {
        // stop caching: keep copies for this session only, clear IndexedDB
        this.readAll().then((all) => {
          for (const sc of all) this.sessionCache[sc.id] = sc;
          if (this.db) this.tx('scenes', 'readwrite', (st) => st.clear()).catch(() => { /* ignore */ });
        });
      } else {
        // resume caching: write session copies back to IndexedDB
        const vals = Object.values(this.sessionCache);
        Promise.all(vals.map((sc) => this.persistLocal(sc))).catch(() => { /* ignore */ });
      }
    });
  }

  render() {
    const v = this.renderVals();
    const rootStyle = {
      height: '100vh', minHeight: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--app)', color: 'var(--text)',
      fontFamily: "'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif", fontSize: 14, overflow: 'hidden',
      '--accent': ACCENT, '--accent-dark': ACCENT_DARK,
    } as React.CSSProperties;
    return (
      <div data-theme={this.state.theme} style={rootStyle}>
        <Header v={v} />
        {v.menuOpen ? <div onClick={v.act.menuClose} style={{ position: 'fixed', inset: 0, zIndex: 15 }} /> : null}
        {v.dbError ? (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'var(--warn-bg)', borderBottom: '1px solid var(--warn-line)', color: 'var(--warn-text)', fontSize: 13, flex: 'none' }}>
            <strong style={{ fontWeight: 600 }}>Working in memory only.</strong>
            <span>{v.dbError} Nothing will persist after reload — export before you close the tab.</span>
          </div>
        ) : null}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
          <ToolRail v={v} />
          <main style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div ref={this.wrapRef} style={{ flex: 1, position: 'relative', minHeight: 0, background: 'var(--canvas)' }}>
              <canvas
                ref={this.canvasRef}
                tabIndex={0}
                role="application"
                aria-label="Drawing canvas. Use the tool buttons or keyboard shortcuts to draw; arrow keys nudge the selection."
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: v.cursor }}
              />
              <CanvasOverlays v={v} />
              {v.editing ? (
                <textarea
                  ref={this.editRef}
                  aria-label="Edit text"
                  onChange={v.act.editChange}
                  onBlur={v.act.editCommit}
                  style={{ position: 'absolute', left: 0, top: 0, margin: 0, padding: 0, border: 'none', outline: '2px solid ' + ACCENT, background: 'var(--panel)', resize: 'none', overflow: 'hidden', lineHeight: 1.25, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: 'center' }}
                />
              ) : null}
            </div>
          </main>
          <SidePanel v={v} />
          {/* Edge handle: rides the panel's leading edge, stays reachable when closed. */}
          <button
            type="button"
            onClick={v.act.sidebar}
            aria-expanded={v.sidebarOpen}
            aria-controls="slate-sidebar"
            aria-label={v.sidebarLabel}
            title={v.sidebarLabel}
            className="hv-accent"
            style={{
              position: 'absolute', right: v.sidebarW, top: '50%', transform: 'translateY(-50%)',
              zIndex: 7, width: 15, height: 46, padding: 0,
              display: 'grid', placeItems: 'center',
              background: 'var(--panel)', color: 'var(--muted)',
              border: '1px solid var(--line-2)', borderRight: 'none',
              borderRadius: '6px 0 0 6px', boxShadow: '-2px 0 6px var(--shadow)',
              transition: 'right 0.22s ease',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'rotate(' + v.sidebarTurn + ')', transition: 'transform 0.22s ease' }}>
              <path d="M4.5 2.5 8 6l-3.5 3.5" />
            </svg>
          </button>
          {v.isGallery ? <Gallery v={v} /> : null}
        </div>
        <FooterBar v={v} />
        {v.toast ? (
          <div role="status" style={{ position: 'fixed', left: '50%', bottom: 52, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 7, background: 'var(--text)', color: '#FFFFFF', fontSize: 13, boxShadow: '0 10px 30px var(--shadow)', animation: 'riseIn 0.16s ease-out', maxWidth: 520, zIndex: 40 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: v.toastDot }} />
            <span style={{ textWrap: 'pretty' } as React.CSSProperties}>{v.toast}</span>
          </div>
        ) : null}
        <Modals v={v} />
      </div>
    );
  }
}

export type V = ReturnType<Whiteboard['renderVals']>;
