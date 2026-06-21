// ---------------------------------------------------------------------------
// Block registry. Numeric IDs + per-block properties (render layer, collision,
// opacity, break time, and which atlas tile each face uses).
// ---------------------------------------------------------------------------

export const Blocks = {
  AIR: 0,
  STONE: 1,
  GRASS: 2,
  DIRT: 3,
  COBBLESTONE: 4,
  SAND: 5,
  OAK_LOG: 6,
  OAK_PLANKS: 7,
  OAK_LEAVES: 8,
  GLASS: 9,
  WATER: 10,
  COAL_ORE: 11,
  IRON_ORE: 12,
  BEDROCK: 13,
} as const;

export type BlockId = number;

export const enum RenderLayer {
  Opaque = 0,
  Cutout = 1, // alpha-blended translucent pane (glass); see-through, no depth write
  Translucent = 2, // alpha-blended (water): no depth write
}

// Which tool category mines a block fastest. Lives here (not items.ts) so block
// defs can reference it without a circular import. `null` == no preferred tool
// (e.g. glass — broken at hand speed by anything).
export const enum ToolType {
  Pickaxe = 0,
  Axe = 1,
  Shovel = 2,
  Hoe = 3,
}

// Atlas tile indices. Order here defines the order tiles are generated/loaded.
export const Tiles = {
  stone: 0,
  dirt: 1,
  grass_top: 2,
  grass_side: 3,
  cobblestone: 4,
  sand: 5,
  oak_log: 6, // bark side
  oak_log_top: 7,
  oak_planks: 8,
  oak_leaves: 9,
  glass: 10,
  water: 11,
  coal_ore: 12,
  iron_ore: 13,
  bedrock: 14,
} as const;

export const TILE_COUNT = 15;

// Map an atlas tile index back to the resource-pack texture name it loads from
// (assets/minecraft/textures/block/<name>.png). Index == Tiles value.
export const TILE_NAMES: string[] = [
  'stone',
  'dirt',
  'grass_block_top',
  'grass_block_side',
  'cobblestone',
  'sand',
  'oak_log',
  'oak_log_top',
  'oak_planks',
  'oak_leaves',
  'glass',
  'water_still',
  'coal_ore',
  'iron_ore',
  'bedrock',
];

export interface BlockDef {
  id: BlockId;
  name: string;
  /** Atlas tile per face: [ +x, -x, +y(top), -y(bottom), +z, -z ]. */
  faces: [number, number, number, number, number, number];
  /** Solid blocks fully hide neighbouring faces and block skylight. */
  opaque: boolean;
  /** Has collision for the player AABB. */
  solid: boolean;
  /** How the mesher batches the block. */
  layer: RenderLayer;
  /** Hide the shared face between two blocks of this same type. */
  selfCull: boolean;
  /**
   * Material hardness (vanilla values). Break time is derived from this, the
   * held tool and tier in interaction.ts:
   *   time = hardness * (canHarvest ? 1.5 : 5) / speedMultiplier
   * Infinity == unbreakable.
   */
  hardness: number;
  /** The tool category that mines this block fastest, or null for none. */
  tool: ToolType | null;
  /**
   * If true, only the correct tool of a high-enough tier puts the block on the
   * fast (1.5x) harvest path; hand/wrong tool falls to the slow 5x path. Stone,
   * cobblestone and ores require a tool; dirt, wood, leaves and glass do not.
   */
  requiresTool: boolean;
  /** Minimum tool mining-level (TIER_LEVEL) for the fast harvest path. */
  tierNeeded: number;
  /** Liquids: no collision, special placement/culling. */
  liquid: boolean;
}

function allFaces(t: number): [number, number, number, number, number, number] {
  return [t, t, t, t, t, t];
}

const T = Tiles;

// Indexed by block id.
export const BLOCKS: BlockDef[] = [];

function def(d: BlockDef) {
  BLOCKS[d.id] = d;
}

// hardness/tool/requiresTool/tierNeeded drive the vanilla break-time formula in
// interaction.ts. Hand times for non-tool blocks match the old breakTime values
// (hardness * 1.5); tool-required blocks now use vanilla hand times (hardness * 5).
const P = ToolType.Pickaxe;
const A = ToolType.Axe;
const S = ToolType.Shovel;
const H = ToolType.Hoe;

def({ id: Blocks.AIR, name: 'air', faces: allFaces(0), opaque: false, solid: false, layer: RenderLayer.Opaque, selfCull: false, hardness: 0, tool: null, requiresTool: false, tierNeeded: 0, liquid: false });
def({ id: Blocks.STONE, name: 'stone', faces: allFaces(T.stone), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 1.5, tool: P, requiresTool: true, tierNeeded: 0, liquid: false });
def({ id: Blocks.GRASS, name: 'grass_block', faces: [T.grass_side, T.grass_side, T.grass_top, T.dirt, T.grass_side, T.grass_side], opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 0.6, tool: S, requiresTool: false, tierNeeded: 0, liquid: false });
def({ id: Blocks.DIRT, name: 'dirt', faces: allFaces(T.dirt), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 0.5, tool: S, requiresTool: false, tierNeeded: 0, liquid: false });
def({ id: Blocks.COBBLESTONE, name: 'cobblestone', faces: allFaces(T.cobblestone), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 2.0, tool: P, requiresTool: true, tierNeeded: 0, liquid: false });
def({ id: Blocks.SAND, name: 'sand', faces: allFaces(T.sand), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 0.5, tool: S, requiresTool: false, tierNeeded: 0, liquid: false });
def({ id: Blocks.OAK_LOG, name: 'oak_log', faces: [T.oak_log, T.oak_log, T.oak_log_top, T.oak_log_top, T.oak_log, T.oak_log], opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 2.0, tool: A, requiresTool: false, tierNeeded: 0, liquid: false });
def({ id: Blocks.OAK_PLANKS, name: 'oak_planks', faces: allFaces(T.oak_planks), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 2.0, tool: A, requiresTool: false, tierNeeded: 0, liquid: false });
def({ id: Blocks.OAK_LEAVES, name: 'oak_leaves', faces: allFaces(T.oak_leaves), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: true, hardness: 0.2, tool: H, requiresTool: false, tierNeeded: 0, liquid: false });
def({ id: Blocks.GLASS, name: 'glass', faces: allFaces(T.glass), opaque: false, solid: true, layer: RenderLayer.Cutout, selfCull: true, hardness: 0.3, tool: null, requiresTool: false, tierNeeded: 0, liquid: false });
def({ id: Blocks.WATER, name: 'water', faces: allFaces(T.water), opaque: false, solid: false, layer: RenderLayer.Translucent, selfCull: true, hardness: Infinity, tool: null, requiresTool: false, tierNeeded: 0, liquid: true });
def({ id: Blocks.COAL_ORE, name: 'coal_ore', faces: allFaces(T.coal_ore), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 3.0, tool: P, requiresTool: true, tierNeeded: 0, liquid: false });
def({ id: Blocks.IRON_ORE, name: 'iron_ore', faces: allFaces(T.iron_ore), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: 3.0, tool: P, requiresTool: true, tierNeeded: 1, liquid: false });
def({ id: Blocks.BEDROCK, name: 'bedrock', faces: allFaces(T.bedrock), opaque: true, solid: true, layer: RenderLayer.Opaque, selfCull: false, hardness: Infinity, tool: null, requiresTool: false, tierNeeded: 0, liquid: false });

export function blockDef(id: BlockId): BlockDef {
  return BLOCKS[id] ?? BLOCKS[0];
}

// The 9 block types the player can place from the hotbar.
export const HOTBAR_BLOCKS: BlockId[] = [
  Blocks.GRASS,
  Blocks.DIRT,
  Blocks.STONE,
  Blocks.COBBLESTONE,
  Blocks.OAK_PLANKS,
  Blocks.OAK_LOG,
  Blocks.SAND,
  Blocks.GLASS,
  Blocks.OAK_LEAVES,
];
