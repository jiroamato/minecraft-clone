// ---------------------------------------------------------------------------
// Block interaction: DDA voxel raycast (reach 4.5), hold-to-break with the
// 10-stage crack overlay and per-block break times, right-click placement that
// never intersects the player, and a thin black selection outline.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import type { World } from './world';
import { Player } from './player';
import { Input } from './input';
import { Blocks, blockDef } from './blocks';
import { Item, breakSeconds } from './items';

const REACH = 4.5;

export interface RayHit {
  x: number;
  y: number;
  z: number; // block hit
  nx: number;
  ny: number;
  nz: number; // face normal
}

export function raycast(world: World, origin: THREE.Vector3, dir: THREE.Vector3, maxDist = REACH): RayHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x);
  const stepY = Math.sign(dir.y);
  const stepZ = Math.sign(dir.z);
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tMaxX = dir.x > 0 ? (x + 1 - origin.x) * tDeltaX : dir.x < 0 ? (origin.x - x) * tDeltaX : Infinity;
  let tMaxY = dir.y > 0 ? (y + 1 - origin.y) * tDeltaY : dir.y < 0 ? (origin.y - y) * tDeltaY : Infinity;
  let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) * tDeltaZ : dir.z < 0 ? (origin.z - z) * tDeltaZ : Infinity;

  let nx = 0,
    ny = 0,
    nz = 0;
  let t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id !== Blocks.AIR && !blockDef(id).liquid) {
      return { x, y, z, nx, ny, nz };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }
  return null;
}

// --- crack overlay textures (10 progressive stages) ------------------------
function generateCrackStages(): THREE.Texture[] {
  const stages: THREE.Texture[] = [];
  const SIZE = 16;
  // accumulate crack pixels across stages so they get denser
  const cracks: [number, number][] = [];
  let seed = 12345;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let s = 0; s < 10; s++) {
    // add a few crack strokes for this stage
    const strokes = 1 + (s >> 1);
    for (let k = 0; k < strokes; k++) {
      let cx = (rand() * SIZE) | 0;
      let cy = (rand() * SIZE) | 0;
      const steps = 3 + ((rand() * (s + 3)) | 0);
      for (let i = 0; i < steps; i++) {
        cracks.push([cx, cy]);
        cx += ((rand() * 3) | 0) - 1;
        cy += ((rand() * 3) | 0) - 1;
        cx = Math.max(0, Math.min(SIZE - 1, cx));
        cy = Math.max(0, Math.min(SIZE - 1, cy));
      }
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const img = ctx.createImageData(SIZE, SIZE);
    for (const [px, py] of cracks) {
      const idx = (py * SIZE + px) * 4;
      img.data[idx] = 0;
      img.data[idx + 1] = 0;
      img.data[idx + 2] = 0;
      img.data[idx + 3] = 180;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    stages.push(tex);
  }
  return stages;
}

export class Interaction {
  private outline: THREE.LineSegments;
  private crack: THREE.Mesh;
  private crackStages: THREE.Texture[];
  private crackMat: THREE.MeshBasicMaterial;

  private breakingKey: string | null = null;
  private breakAccum = 0;
  breakProgress = 0; // 0..1, for HUD if desired

  constructor(scene: THREE.Scene) {
    // selection outline (thin black box)
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(box);
    this.outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthTest: true }),
    );
    this.outline.visible = false;
    this.outline.renderOrder = 999;
    scene.add(this.outline);

    // crack overlay box
    this.crackStages = generateCrackStages();
    this.crackMat = new THREE.MeshBasicMaterial({
      map: this.crackStages[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.001, 1.001, 1.001), this.crackMat);
    this.crack.visible = false;
    this.crack.renderOrder = 1000;
    scene.add(this.crack);
  }

  private intersectsPlayer(bx: number, by: number, bz: number, player: Player): boolean {
    const minX = player.pos.x - 0.3;
    const maxX = player.pos.x + 0.3;
    const minY = player.pos.y;
    const maxY = player.pos.y + 1.8;
    const minZ = player.pos.z - 0.3;
    const maxZ = player.pos.z + 0.3;
    return bx + 1 > minX && bx < maxX && by + 1 > minY && by < maxY && bz + 1 > minZ && bz < maxZ;
  }

  /** Returns true if the player swung (broke or placed) this frame. */
  update(dt: number, input: Input, player: Player, world: World, selected: Item): boolean {
    const origin = player.eyePosition;
    const dir = player.getLookDir();
    const hit = raycast(world, origin, dir);
    let swung = false;

    if (!hit) {
      this.outline.visible = false;
      this.crack.visible = false;
      this.breakingKey = null;
      this.breakAccum = 0;
      this.breakProgress = 0;
      // still allow swing animation feedback on empty click
      if (input.leftJustPressed || input.rightJustPressed) swung = true;
      return swung;
    }

    this.outline.visible = true;
    this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    // --- breaking (hold left) ---
    const key = hit.x + ',' + hit.y + ',' + hit.z;
    const id = world.getBlock(hit.x, hit.y, hit.z);
    const def = blockDef(id);
    // Break time depends on the held item: correct tool + tier mine far faster.
    const breakT = breakSeconds(def, selected);

    if (input.leftHeld && Number.isFinite(breakT)) {
      if (this.breakingKey !== key) {
        this.breakingKey = key;
        this.breakAccum = 0;
      }
      this.breakAccum += dt;
      this.breakProgress = Math.min(1, this.breakAccum / breakT);
      const stage = Math.min(9, Math.floor(this.breakProgress * 10));
      this.crack.visible = true;
      this.crack.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.crackMat.map = this.crackStages[stage];
      this.crackMat.needsUpdate = true;
      if (input.leftJustPressed) swung = true;
      if (this.breakProgress >= 1) {
        world.setBlock(hit.x, hit.y, hit.z, Blocks.AIR);
        this.breakingKey = null;
        this.breakAccum = 0;
        this.breakProgress = 0;
        this.crack.visible = false;
        swung = true;
      }
    } else {
      this.breakingKey = null;
      this.breakAccum = 0;
      this.breakProgress = 0;
      this.crack.visible = false;
    }

    // continuous swing while holding to break
    if (input.leftHeld) swung = true;

    // --- placing (right-click) --- only blocks place; tools just swing.
    if (input.rightJustPressed) {
      if (selected.kind === 'block') {
        const px = hit.x + hit.nx;
        const py = hit.y + hit.ny;
        const pz = hit.z + hit.nz;
        const targetId = world.getBlock(px, py, pz);
        const targetDef = blockDef(targetId);
        const replaceable = targetId === Blocks.AIR || targetDef.liquid;
        if (replaceable && !(blockDef(selected.block).solid && this.intersectsPlayer(px, py, pz, player))) {
          world.setBlock(px, py, pz, selected.block);
        }
      }
      swung = true;
    }

    return swung;
  }
}
