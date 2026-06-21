// ---------------------------------------------------------------------------
// Creative item picker (press E). A grid overlay of every block + tool; click a
// cell to drop that item into the target hotbar slot. 1–9 choose the target
// slot live. Opening/closing and pointer-lock are coordinated by main.ts.
// ---------------------------------------------------------------------------

import { Item, allItems, toolDisplayName } from './items';
import { blockDef } from './blocks';
import { makeItemIcon } from './textures';

function itemLabel(item: Item): string {
  return item.kind === 'block'
    ? blockDef(item.block).name.replace(/_/g, ' ')
    : toolDisplayName(item.tool, item.tier);
}

export class Picker {
  private el = document.getElementById('picker')!;
  private gridEl = document.getElementById('pickerGrid')!;
  private titleEl = document.getElementById('pickerTitle')!;
  private items = allItems();

  open = false;
  targetSlot = 0;

  /** Called when a grid item is clicked: assign `item` to hotbar `slot`. */
  onPick: (slot: number, item: Item) => void = () => {};
  /** Called when the target slot changes via 1–9, so the hotbar can follow. */
  onSlotChange: (slot: number) => void = () => {};

  constructor(tiles: HTMLCanvasElement[]) {
    this.build(tiles);
    // While open, 1–9 retarget the slot. Open/close (E/Esc) is owned by main.ts
    // so a single keypress can't both close and reopen the picker.
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code.length === 6 && e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) {
          this.targetSlot = n - 1;
          this.onSlotChange(this.targetSlot);
          this.refreshTitle();
        }
      }
    });
  }

  /** (Re)build the grid cells — also called after a resource pack reload. */
  build(tiles: HTMLCanvasElement[]): void {
    this.gridEl.innerHTML = '';
    for (const item of this.items) {
      const cell = document.createElement('button');
      cell.className = 'pcell';
      cell.title = itemLabel(item);
      cell.appendChild(makeItemIcon(item, tiles, 48));
      cell.addEventListener('click', () => this.onPick(this.targetSlot, item));
      this.gridEl.appendChild(cell);
    }
  }

  show(targetSlot: number): void {
    this.targetSlot = targetSlot;
    this.open = true;
    this.el.classList.remove('hidden');
    this.refreshTitle();
  }

  close(): void {
    this.open = false;
    this.el.classList.add('hidden');
  }

  private refreshTitle(): void {
    this.titleEl.textContent =
      `Pick an item  →  slot ${this.targetSlot + 1}     ·     [1–9] choose slot     ·     [E] / [Esc] close`;
  }
}
