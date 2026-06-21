# Tool-based mining (speed-only) — design

**Date:** 2026-06-20
**Status:** Approved
**Scope decision:** Mining-speed only · full tier ladder · creative item picker (E)

## Goal

Add Minecraft-style tools (pickaxe / axe / shovel / hoe) that change how fast
blocks break, faithful to vanilla's breaking formula and material tiers. The
game stays creative-mode: no durability, no drops, no inventory, no crafting.
Tools are infinite, exactly like placeable blocks are today.

## Faithful mechanics being modelled

- **Correct-tool categories:** pickaxe → stone/cobble/ores; axe → log/planks;
  shovel → dirt/grass/sand; hoe → leaves. Glass has no correct tool.
- **Material tiers → speed multiplier:** Wood ×2, Stone ×4, Iron ×6, Gold ×12,
  Diamond ×8, Netherite ×9. (Hand = ×1.)
- **Mining-level for the speed split:** Wood 0, Gold 0, Stone 1, Iron 2,
  Diamond 3, Netherite 4.
- **Break-time formula** (per vanilla):
  `time = hardness × (canHarvest ? 1.5 : 5) / speedMultiplier`
  where `speedMultiplier` = the tier multiplier **only when the held tool is the
  correct type** (else 1), and
  `canHarvest = !requiresTool || (correctTool && miningLevel ≥ tierNeeded)`.

This reproduces vanilla times: stone by hand 7.5 s, wood-pick 1.1 s, diamond
0.28 s; iron ore stays on the slow ×5 path until a stone-tier pickaxe.

**Explicitly out of scope:** durability, block drops, inventory, crafting,
drop-gating, sword/combat, resource-pack-supplied tool textures.

## Data: block properties (`src/blocks.ts`)

`breakTime` is replaced by `hardness`; three fields are added.

| Block | hardness | tool | requiresTool | tierNeeded |
|-------|---------:|------|:---:|:---:|
| stone | 1.5 | Pickaxe | yes | 0 |
| cobblestone | 2.0 | Pickaxe | yes | 0 |
| coal_ore | 3.0 | Pickaxe | yes | 0 |
| iron_ore | 3.0 | Pickaxe | yes | 1 |
| grass_block | 0.6 | Shovel | no | 0 |
| dirt | 0.5 | Shovel | no | 0 |
| sand | 0.5 | Shovel | no | 0 |
| oak_log | 2.0 | Axe | no | 0 |
| oak_planks | 2.0 | Axe | no | 0 |
| oak_leaves | 0.2 | Hoe | no | 0 |
| glass | 0.3 | none | no | 0 |
| water / bedrock | ∞ | — | — | — |

Hand break-times for non-tool-required blocks are unchanged (e.g. dirt 0.75 s);
tool-required blocks now use vanilla hand-times (stone 5 s → 7.5 s). Approved.

## Item model (`src/items.ts`, new)

```ts
type Item =
  | { kind: 'block'; block: BlockId }
  | { kind: 'tool'; tool: ToolType; tier: Tier };
enum ToolType { Pickaxe, Axe, Shovel, Hoe }
enum Tier { Wood, Stone, Iron, Gold, Diamond, Netherite }
```

Tables: `TIER_SPEED[tier]`, `TIER_LEVEL[tier]`. Helpers: `itemKey(item)` (stable
id for caching/dedup), `defaultHotbar()` (the current 9 blocks as items),
`allItems()` (9 blocks + 24 tools, the picker's catalogue).

## Tool textures (`src/textures.ts`)

Procedural 16×16 sprites with transparent background: a shared brown stick plus
a per-tool head (distinct blocky shapes) recoloured per tier (wood brown, stone
grey, iron near-white, gold yellow, diamond cyan, netherite near-black).
`makeToolIcon(tool, tier, size)` → upscaled canvas for hotbar/picker;
`makeToolTexture(tool, tier)` → cached nearest-filtered `CanvasTexture` for the
held plane.

## Break formula (`src/interaction.ts`)

`update()` takes the selected `Item` instead of a `BlockId`. It computes
`breakSeconds(blockDef, item)` per the formula above; `Infinity` ⇒ unbreakable.
Right-click placement is skipped when a tool is held (tools don't place); the
swing animation still plays.

## Held rendering (`src/held.ts`)

`setItem(item)`: blocks keep the existing skinned cube; tools render a flat
nearest-filtered, alpha-tested textured plane posed in the lower-right at a
held-tool angle. The existing swing transform is applied to whichever mesh is
active.

## Creative item picker (`src/picker.ts` + `index.html` + `src/ui.ts`)

- **E** opens a grid overlay of every item; pointer unlocks. While open, the
  start/"Click to Play" overlay is suppressed (a `pickerOpen` flag gates
  `onLockChange`).
- **1–9** choose the target hotbar slot (live); **click** an item assigns it to
  the target slot and updates the hotbar icon + held item immediately.
- **E / Esc** close the picker and re-request pointer lock (user-gesture safe).

The hotbar (`src/ui.ts`) holds `Item[9]` (default = the current 9 blocks), and
renders a block iso-icon or a tool sprite per slot. `selectedItem` feeds both
`interaction.update` and `held.setItem`.

## Testing / verification

`npm run build` (tsc strict + vite). Manual verification in the Vite preview:
mining a log is fast with an axe and slow with a pickaxe; iron ore is slow with
a wood pickaxe and fast with a stone+ pickaxe; picker assigns tools; held tool
renders as a sprite and swings.
