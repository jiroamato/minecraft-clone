// ---------------------------------------------------------------------------
// HUD: the 9-slot hotbar (Minecraft gray slot style + white selected border),
// isometric block icons, and the F3-style debug overlay.
// ---------------------------------------------------------------------------

import { Item, defaultHotbar } from './items';
import { makeItemIcon } from './textures';

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
  private tiles: HTMLCanvasElement[] = [];
  /** The 9 hotbar items. Defaults to the placeable blocks; the picker swaps in tools. */
  hotbar: Item[] = defaultHotbar();
  selected = 0;
  debugVisible = false;

  /** Update the always-on top-left FPS counter. */
  updateFps(fps: number): void {
    this.fpsEl.textContent = fps + ' fps';
  }

  buildHotbar(tiles: HTMLCanvasElement[]): void {
    this.tiles = tiles;
    this.hotbarEl.innerHTML = '';
    this.slots = [];
    this.hotbar.forEach((_item, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === this.selected ? ' selected' : '');
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);
      slot.appendChild(num);
      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
      this.renderSlotIcon(i);
    });
  }

  /** (Re)draw a single slot's icon from its current item. */
  private renderSlotIcon(i: number): void {
    const slot = this.slots[i];
    if (!slot) return;
    slot.querySelector('canvas')?.remove();
    const icon = makeItemIcon(this.hotbar[i], this.tiles, 64);
    slot.insertBefore(icon, slot.firstChild);
  }

  /** Replace the item in a slot (used by the creative picker). */
  setSlotItem(i: number, item: Item): void {
    if (i < 0 || i >= this.hotbar.length) return;
    this.hotbar[i] = item;
    this.renderSlotIcon(i);
  }

  setSelected(i: number): void {
    const n = this.hotbar.length;
    this.selected = ((i % n) + n) % n;
    this.slots.forEach((s, idx) => s.classList.toggle('selected', idx === this.selected));
  }

  get selectedItem(): Item {
    return this.hotbar[this.selected];
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
