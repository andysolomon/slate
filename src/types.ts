export type ElType =
  | 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'line' | 'arrow'
  | 'draw' | 'text' | 'sticky' | 'frame' | 'image' | 'embed';

export type Dash = 'solid' | 'dashed' | 'dotted';
export type Curve = 'straight' | 'curved' | 'elbow';
export type Head = 'none' | 'arrow' | 'triangle' | 'dot' | 'bar';

/** The flat element model — field names and semantics match the prototype and
 *  the {type:"slate-scene",version:1} JSON interchange format exactly. */
export interface El {
  id: string;
  type: ElType;
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill: string;
  sw: number;
  opacity: number;
  fontSize: number;
  label: string;
  dash: Dash;
  rough: number;
  curve: Curve;
  head?: Head;
  tail?: Head;
  points?: [number, number][];
  text?: string;
  src?: string;
  name?: string;
  tri?: [number, number][];
  startBinding?: string | null;
  endBinding?: string | null;
  /** transient fields used while converting Excalidraw scenes */
  exStart?: string | null;
  exEnd?: string | null;
}

export interface View { x: number; y: number; z: number; }

export interface Scene {
  id: string;
  name: string;
  elements: El[];
  view: View;
  updatedAt: number;
  isSample: boolean;
}

export interface SceneMeta {
  id: string;
  name: string;
  updatedAt: number;
  count: number;
  isSample: boolean;
}

export interface GalleryCard extends SceneMeta {
  thumb: string;
}

export interface LibItem {
  id: string;
  name: string;
  elements: El[];
  w: number;
  h: number;
}

export interface Library {
  id: string;
  name: string;
  items: LibItem[];
  addedAt: number;
}

export interface AuthUser {
  name: string;
  email: string;
  /** Google `sub` claim — stable user id */
  sub: string;
  since: number;
}

export interface StyleDefaults {
  stroke: string;
  fill: string;
  sw: number;
  opacity: number;
  fontSize: number;
  dash: Dash;
  rough: number;
  curve: Curve;
  head: Head;
  tail: Head;
}

export type Tool = 'v' | 'h' | 'r' | 'o' | 'd' | 'a' | 'l' | 'p' | 't' | 's' | 'f' | 'e' | 'k' | 'b';

export interface Point { x: number; y: number; }
