// ---------------------------------------------------------------------------
// HUD: the 9-slot hotbar (Minecraft gray slot style + white selected border),
// isometric block icons, and the F3-style debug overlay.
// ---------------------------------------------------------------------------

import { HOTBAR_BLOCKS } from './blocks';
import { makeBlockIcon } from './textures';

export interface DebugInfo {
  fps: number;
  x: number;
  y: number;
  z: number;
  facing: string;
  chunkX: number;
  chunkZ: number;
  chunks: number;
  flying: boolean;
  onGround: boolean;
}

export class UI {
  private hotbarEl = document.getElementById('hotbar')!;
  private debugEl = document.getElementById('debug')!;
  private fpsEl = document.getElementById('fps')!;
  private slots: HTMLElement[] = [];
  selected = 0;
  debugVisible = false;

  /** Update the always-on top-left FPS counter. */
  updateFps(fps: number): void {
    this.fpsEl.textContent = fps + ' fps';
  }

  buildHotbar(tiles: HTMLCanvasElement[]): void {
    this.hotbarEl.innerHTML = '';
    this.slots = [];
    HOTBAR_BLOCKS.forEach((blockId, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === this.selected ? ' selected' : '');
      const icon = makeBlockIcon(blockId, tiles, 64);
      slot.appendChild(icon);
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);
      slot.appendChild(num);
      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
    });
  }

  setSelected(i: number): void {
    this.selected = ((i % HOTBAR_BLOCKS.length) + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
    this.slots.forEach((s, idx) => s.classList.toggle('selected', idx === this.selected));
  }

  get selectedBlock(): number {
    return HOTBAR_BLOCKS[this.selected];
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    this.debugEl.classList.toggle('visible', this.debugVisible);
    // the F3 overlay reports FPS itself, so hide the standalone counter then
    this.fpsEl.classList.toggle('hidden', this.debugVisible);
  }

  updateDebug(d: DebugInfo): void {
    if (!this.debugVisible) return;
    this.debugEl.textContent =
      `Vibeland  (TS + Three.js)\n` +
      `${d.fps} fps\n` +
      `XYZ: ${d.x.toFixed(2)} / ${d.y.toFixed(2)} / ${d.z.toFixed(2)}\n` +
      `Block: ${Math.floor(d.x)} ${Math.floor(d.y)} ${Math.floor(d.z)}\n` +
      `Chunk: ${d.chunkX}, ${d.chunkZ}\n` +
      `Facing: ${d.facing}\n` +
      `Chunks loaded: ${d.chunks}\n` +
      `Mode: ${d.flying ? 'fly' : 'survive'}${d.onGround ? ' (grounded)' : ''}`;
  }
}
