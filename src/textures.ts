// ---------------------------------------------------------------------------
// Procedural 16x16 pixel-art block textures, generated in code (no Mojang
// assets). Tiles are assembled into a single horizontal-strip atlas used by the
// chunk mesher, and rendered into pseudo-3D isometric icons for the hotbar.
//
// A resource-pack loader (resourcepack.ts) can swap individual tile canvases
// and ask us to rebuild the atlas, so any vanilla-resolution pack matches 1:1.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { TILE_COUNT, ToolType } from './blocks';
import { blockDef, BlockId } from './blocks';
import { Tier, Item } from './items';

export const TILE_RES = 16;

// --- small seeded PRNG so generated textures are deterministic --------------
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = Math.imul(a ^ (a >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

type RGBA = [number, number, number, number];

class Tile {
  data: Uint8ClampedArray;
  constructor() {
    this.data = new Uint8ClampedArray(TILE_RES * TILE_RES * 4);
  }
  set(x: number, y: number, c: RGBA) {
    if (x < 0 || y < 0 || x >= TILE_RES || y >= TILE_RES) return;
    const i = (y * TILE_RES + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3];
  }
  fill(c: RGBA) {
    for (let y = 0; y < TILE_RES; y++) for (let x = 0; x < TILE_RES; x++) this.set(x, y, c);
  }
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = TILE_RES;
    cv.height = TILE_RES;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(TILE_RES, TILE_RES);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// vary a base colour by +/- amount per channel
function shade(base: RGBA, d: number): RGBA {
  return [base[0] + d, base[1] + d, base[2] + d, base[3]];
}

// ---------------------------------------------------------------------------
// Individual tile generators
// ---------------------------------------------------------------------------

function genStone(seed: number, base: RGBA = [127, 127, 127, 255]): Tile {
  const t = new Tile();
  const r = rng(seed);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = (r() - 0.5) * 26;
      t.set(x, y, shade(base, n));
    }
  // a few darker cracks
  for (let i = 0; i < 10; i++) {
    const x = (r() * 16) | 0;
    const y = (r() * 16) | 0;
    t.set(x, y, shade(base, -42));
  }
  return t;
}

function genDirt(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const base: RGBA = [134, 96, 67, 255];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = (r() - 0.5) * 30;
      t.set(x, y, shade(base, n));
    }
  for (let i = 0; i < 18; i++) t.set((r() * 16) | 0, (r() * 16) | 0, shade(base, -34));
  return t;
}

function genGrassTop(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const base: RGBA = [110, 162, 73, 255];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = (r() - 0.5) * 34;
      t.set(x, y, shade(base, n));
    }
  for (let i = 0; i < 22; i++) t.set((r() * 16) | 0, (r() * 16) | 0, shade(base, -30));
  return t;
}

function genGrassSide(seed: number): Tile {
  // dirt body with a green fringe along the top + a couple of drips.
  const t = genDirt(seed);
  const r = rng(seed ^ 0x55);
  const green: RGBA = [104, 156, 70, 255];
  const fringe = 4;
  for (let x = 0; x < 16; x++) {
    const h = fringe + (r() < 0.4 ? 1 : 0); // jagged bottom edge
    for (let y = 0; y < h; y++) t.set(x, y, shade(green, (r() - 0.5) * 30));
    if (r() < 0.25) t.set(x, h, shade(green, -10)); // a hanging blade
  }
  return t;
}

function genCobble(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const base: RGBA = [122, 122, 122, 255];
  t.fill(shade(base, -34)); // dark mortar background
  // scatter rounded stones
  const stones = 9;
  for (let i = 0; i < stones; i++) {
    const sx = 1 + ((r() * 13) | 0);
    const sy = 1 + ((r() * 13) | 0);
    const w = 2 + ((r() * 3) | 0);
    const h = 2 + ((r() * 3) | 0);
    const tone = (r() - 0.3) * 30;
    for (let y = sy; y < sy + h; y++)
      for (let x = sx; x < sx + w; x++) {
        if (x >= 15 || y >= 15) continue;
        t.set(x, y, shade(base, tone + (r() - 0.5) * 18));
      }
  }
  return t;
}

function genSand(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const base: RGBA = [219, 205, 158, 255];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) t.set(x, y, shade(base, (r() - 0.5) * 22));
  for (let i = 0; i < 12; i++) t.set((r() * 16) | 0, (r() * 16) | 0, shade(base, -26));
  return t;
}

function genLogSide(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const bark: RGBA = [102, 78, 48, 255];
  for (let x = 0; x < 16; x++) {
    const streak = (r() - 0.5) * 22;
    for (let y = 0; y < 16; y++) {
      const n = (r() - 0.5) * 14 + streak;
      t.set(x, y, shade(bark, n));
    }
  }
  // vertical grooves
  for (let i = 0; i < 4; i++) {
    const x = 1 + ((r() * 14) | 0);
    for (let y = 0; y < 16; y++) t.set(x, y, shade(bark, -30 + (r() - 0.5) * 10));
  }
  return t;
}

function genLogTop(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const wood: RGBA = [160, 128, 82, 255];
  const cx = 7.5;
  const cy = 7.5;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const ring = Math.sin(d * 1.7) * 16;
      const n = ring + (r() - 0.5) * 10;
      t.set(x, y, shade(wood, n));
    }
  // bark ring on the border
  for (let i = 0; i < 16; i++) {
    t.set(i, 0, shade([96, 72, 44, 255], (r() - 0.5) * 12));
    t.set(i, 15, shade([96, 72, 44, 255], (r() - 0.5) * 12));
    t.set(0, i, shade([96, 72, 44, 255], (r() - 0.5) * 12));
    t.set(15, i, shade([96, 72, 44, 255], (r() - 0.5) * 12));
  }
  return t;
}

function genPlanks(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const base: RGBA = [164, 132, 80, 255];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = (r() - 0.5) * 16;
      t.set(x, y, shade(base, n));
    }
  // horizontal plank seams every 4 rows
  for (let y = 3; y < 16; y += 4) for (let x = 0; x < 16; x++) t.set(x, y, shade(base, -40));
  // a couple of vertical board joints, staggered
  for (let band = 0; band < 4; band++) {
    const jointX = 2 + ((r() * 12) | 0);
    const y0 = band * 4;
    for (let y = y0; y < y0 + 3; y++) t.set(jointX, y, shade(base, -34));
  }
  // small knots
  for (let i = 0; i < 3; i++) t.set(1 + ((r() * 14) | 0), 1 + ((r() * 14) | 0), shade(base, -48));
  return t;
}

function genLeaves(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const base: RGBA = [62, 102, 44, 255];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = (r() - 0.5) * 40;
      const c = shade(base, n);
      // occasional bright/dark leaf clusters
      if (r() < 0.12) t.set(x, y, shade(base, 26));
      else if (r() < 0.14) t.set(x, y, shade(base, -34));
      else t.set(x, y, c);
    }
  return t;
}

function genGlass(_seed: number): Tile {
  const t = new Tile();
  // Faint translucent blue-white pane (alpha-blended), so glass reads as glass
  // — visible but see-through — rather than a fully clear (invisible) hole.
  const body: RGBA = [170, 208, 230, 92];
  t.fill(body);
  // defined border frame
  const frame: RGBA = [228, 242, 250, 235];
  for (let i = 0; i < 16; i++) {
    t.set(i, 0, frame);
    t.set(i, 15, frame);
    t.set(0, i, frame);
    t.set(15, i, frame);
  }
  // inner corner accents
  for (const [cx, cy] of [[1, 1], [14, 1], [1, 14], [14, 14]] as const) t.set(cx, cy, frame);
  // diagonal reflection streaks (the classic glass shine)
  for (let i = 0; i < 6; i++) t.set(3 + i, 11 - i, [255, 255, 255, 170]);
  for (let i = 0; i < 3; i++) t.set(9 + i, 12 - i, [255, 255, 255, 130]);
  return t;
}

function genWater(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  const base: RGBA = [56, 104, 196, 200];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      // gentle horizontal wave banding
      const wave = Math.sin((y + x * 0.3) * 0.8) * 12;
      const n = (r() - 0.5) * 10 + wave;
      t.set(x, y, [base[0] + n, base[1] + n, base[2] + n, base[3]]);
    }
  return t;
}

function genOre(seed: number, blobColor: RGBA): Tile {
  const t = genStone(seed); // ore sits in a stone matrix
  const r = rng(seed ^ 0xabcd);
  const blobs = 4;
  for (let i = 0; i < blobs; i++) {
    const sx = 2 + ((r() * 11) | 0);
    const sy = 2 + ((r() * 11) | 0);
    const w = 2 + ((r() * 2) | 0);
    const h = 2 + ((r() * 2) | 0);
    for (let y = sy; y < sy + h; y++)
      for (let x = sx; x < sx + w; x++) {
        if (x > 14 || y > 14) continue;
        if (r() < 0.78) t.set(x, y, shade(blobColor, (r() - 0.5) * 30));
      }
  }
  return t;
}

function genBedrock(seed: number): Tile {
  const t = new Tile();
  const r = rng(seed);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const v = 40 + ((r() * 60) | 0);
      t.set(x, y, [v, v, v, 255]);
    }
  return t;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate the default procedural tile set as an array of 16x16 canvases. */
export function generateDefaultTiles(): HTMLCanvasElement[] {
  const tiles: Tile[] = [];
  tiles[0] = genStone(101);
  tiles[1] = genDirt(202);
  tiles[2] = genGrassTop(303);
  tiles[3] = genGrassSide(404);
  tiles[4] = genCobble(505);
  tiles[5] = genSand(606);
  tiles[6] = genLogSide(707);
  tiles[7] = genLogTop(808);
  tiles[8] = genPlanks(909);
  tiles[9] = genLeaves(111);
  tiles[10] = genGlass(222);
  tiles[11] = genWater(333);
  tiles[12] = genOre(444, [38, 38, 40, 255]); // coal
  tiles[13] = genOre(555, [216, 175, 147, 255]); // iron
  tiles[14] = genBedrock(666);
  return tiles.map((t) => t.toCanvas());
}

export const ATLAS_W = TILE_RES * TILE_COUNT;
export const ATLAS_H = TILE_RES;

/** (Re)draw the tile canvases into an existing atlas canvas. */
export function paintAtlas(canvas: HTMLCanvasElement, tiles: HTMLCanvasElement[]): void {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
  for (let i = 0; i < TILE_COUNT; i++) {
    if (tiles[i]) ctx.drawImage(tiles[i], 0, 0, tiles[i].width, tiles[i].height, i * TILE_RES, 0, TILE_RES, TILE_RES);
  }
}

/** Assemble tile canvases into one strip atlas + a configured THREE texture. */
export function buildAtlas(tiles: HTMLCanvasElement[]): {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  paintAtlas(canvas, tiles);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // canvas row 0 == v 0 (top of tile)
  texture.needsUpdate = true;
  return { canvas, texture };
}

/**
 * UV rectangle for a tile, inset by half a texel to avoid bleeding between
 * neighbouring atlas tiles under nearest filtering. Returns [u0, v0, u1, v1]
 * where v0 is the TOP of the tile (flipY === false).
 */
export function tileUV(tileIndex: number): [number, number, number, number] {
  const uEps = 0.5 / ATLAS_W;
  const vEps = 0.5 / ATLAS_H;
  const u0 = (tileIndex * TILE_RES) / ATLAS_W + uEps;
  const u1 = ((tileIndex + 1) * TILE_RES) / ATLAS_W - uEps;
  return [u0, vEps, u1, 1 - vEps];
}

// ---------------------------------------------------------------------------
// Isometric hotbar icon
// ---------------------------------------------------------------------------

/** Render a pseudo-3D block icon (top + two sides, shaded) into a canvas. */
export function makeBlockIcon(blockId: BlockId, tiles: HTMLCanvasElement[], size = 64): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const def = blockDef(blockId);
  const topTile = tiles[def.faces[2]];
  const leftTile = tiles[def.faces[1]]; // -x face
  const rightTile = tiles[def.faces[4]]; // +z face

  const cx = size / 2;
  const w = size * 0.4; // half width of top diamond
  const h = w * 0.5;
  const sideH = w * 1.08;
  const cy0 = size * 0.12;

  const T = { x: cx, y: cy0 };
  const R = { x: cx + w, y: cy0 + h };
  const B = { x: cx, y: cy0 + 2 * h };
  const L = { x: cx - w, y: cy0 + h };
  const B2 = { x: B.x, y: B.y + sideH };
  const L2 = { x: L.x, y: L.y + sideH };
  const R2 = { x: R.x, y: R.y + sideH };

  // face = parallelogram defined by origin O and basis to U (tile +x) and V (tile +y)
  function drawFace(tile: HTMLCanvasElement | undefined, O: any, U: any, V: any, bright: number) {
    if (!tile) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(O.x, O.y);
    ctx.lineTo(O.x + U.x, O.y + U.y);
    ctx.lineTo(O.x + U.x + V.x, O.y + U.y + V.y);
    ctx.lineTo(O.x + V.x, O.y + V.y);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(U.x / TILE_RES, U.y / TILE_RES, V.x / TILE_RES, V.y / TILE_RES, O.x, O.y);
    ctx.drawImage(tile, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // shade overlay
    ctx.fillStyle = `rgba(0,0,0,${1 - bright})`;
    ctx.beginPath();
    ctx.moveTo(O.x, O.y);
    ctx.lineTo(O.x + U.x, O.y + U.y);
    ctx.lineTo(O.x + U.x + V.x, O.y + U.y + V.y);
    ctx.lineTo(O.x + V.x, O.y + V.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // top face (T as origin, U toward R, V toward L)
  drawFace(topTile, T, { x: R.x - T.x, y: R.y - T.y }, { x: L.x - T.x, y: L.y - T.y }, 1.0);
  // left face (L origin, U toward B, V down)
  drawFace(leftTile, L, { x: B.x - L.x, y: B.y - L.y }, { x: 0, y: sideH }, 0.8);
  // right face (B origin, U toward R, V down)
  drawFace(rightTile, B, { x: R.x - B.x, y: R.y - B.y }, { x: 0, y: sideH }, 0.6);

  // suppress unused-var lint for the helper corners we keep for readability
  void B2;
  void L2;
  void R2;

  return cv;
}

// ---------------------------------------------------------------------------
// Tool sprites: procedural 16x16 flat item icons (transparent background). A
// shared brown stick plus a per-tool head shape, recoloured per material tier.
// Used both as upscaled HUD icons and as the texture on the held tool plane.
// ---------------------------------------------------------------------------

const STICK: RGBA = [110, 78, 46, 255];

// Head fill colour per material tier.
const TIER_HEAD: Record<Tier, RGBA> = {
  [Tier.Wood]: [143, 101, 56, 255],
  [Tier.Stone]: [130, 130, 130, 255],
  [Tier.Iron]: [216, 216, 216, 255],
  [Tier.Gold]: [250, 213, 79, 255],
  [Tier.Diamond]: [80, 217, 211, 255],
  [Tier.Netherite]: [77, 70, 76, 255],
};

// Head pixels per tool, in the top-right quadrant where the stick ends. Each is
// a distinct, readable silhouette at 16x16.
const HEAD_PIXELS: Record<ToolType, [number, number][]> = {
  [ToolType.Pickaxe]: [[9, 4], [10, 3], [11, 2], [12, 2], [13, 3], [14, 4], [10, 4], [11, 3], [12, 3], [13, 4]],
  [ToolType.Axe]: [[12, 2], [13, 2], [14, 2], [12, 3], [13, 3], [14, 3], [12, 4], [13, 4], [14, 4], [13, 5], [14, 5]],
  [ToolType.Shovel]: [[10, 1], [11, 1], [12, 1], [10, 2], [11, 2], [12, 2], [10, 3], [11, 3], [12, 3], [11, 4]],
  [ToolType.Hoe]: [[10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [10, 3]],
};

function genToolSprite(toolType: ToolType, tier: Tier): Tile {
  const t = new Tile();
  const r = rng((toolType + 1) * 131 + (tier + 1) * 17);
  // handle: a 2px-thick diagonal stick from lower-left up to the head
  for (let i = 0; i < 9; i++) {
    const x = 3 + i;
    const y = 13 - i;
    t.set(x, y, shade(STICK, (r() - 0.5) * 12));
    t.set(x + 1, y, shade(STICK, (r() - 0.5) * 12 - 6));
  }
  // head
  const head = TIER_HEAD[tier];
  for (const [x, y] of HEAD_PIXELS[toolType]) t.set(x, y, shade(head, (r() - 0.5) * 22));
  return t;
}

// Cache key shared by the sprite-canvas and held-texture caches.
const toolCacheKey = (toolType: ToolType, tier: Tier) => toolType + ':' + tier;

const toolSpriteCache = new Map<string, HTMLCanvasElement>();
function toolSpriteCanvas(toolType: ToolType, tier: Tier): HTMLCanvasElement {
  const k = toolCacheKey(toolType, tier);
  let cv = toolSpriteCache.get(k);
  if (!cv) {
    cv = genToolSprite(toolType, tier).toCanvas();
    toolSpriteCache.set(k, cv);
  }
  return cv;
}

/** Upscaled flat tool icon for the hotbar / picker. */
export function makeToolIcon(toolType: ToolType, tier: Tier, size = 64): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(toolSpriteCanvas(toolType, tier), 0, 0, TILE_RES, TILE_RES, 0, 0, size, size);
  return cv;
}

const toolTexCache = new Map<string, THREE.CanvasTexture>();
/** Nearest-filtered, transparent texture of a tool sprite for the held plane. */
export function makeToolTexture(toolType: ToolType, tier: Tier): THREE.CanvasTexture {
  const k = toolCacheKey(toolType, tier);
  let tex = toolTexCache.get(k);
  if (!tex) {
    tex = new THREE.CanvasTexture(toolSpriteCanvas(toolType, tier));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    toolTexCache.set(k, tex);
  }
  return tex;
}

/** Icon for any hotbar/picker item: block iso-icon or flat tool sprite. */
export function makeItemIcon(item: Item, tiles: HTMLCanvasElement[], size = 64): HTMLCanvasElement {
  return item.kind === 'block'
    ? makeBlockIcon(item.block, tiles, size)
    : makeToolIcon(item.tool, item.tier, size);
}
