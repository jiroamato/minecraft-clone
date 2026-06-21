// ---------------------------------------------------------------------------
// Entry point: wires the renderer, world, player, input, sky, HUD and chunk
// streaming together and runs the frame loop.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { World } from './world';
import { Player } from './player';
import { Input } from './input';
import { Sky } from './sky';
import { HeldItem } from './held';
import { UI } from './ui';
import { Interaction } from './interaction';
import { ChunkManager } from './chunkManager';
import { makeChunkMaterials } from './chunkMaterial';
import { generateDefaultTiles, buildAtlas, paintAtlas } from './textures';
import { loadResourcePack } from './resourcepack';
import { CHUNK_SX, CHUNK_SZ, floorDiv } from './constants';

// --- renderer / scene ---
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// --- textures / materials ---
const tiles = generateDefaultTiles();
const { canvas: atlasCanvas, texture: atlasTexture } = buildAtlas(tiles);
const materials = makeChunkMaterials(atlasTexture);

// --- world & systems ---
const SEED = 1337;
const world = new World(SEED);
const aspect = window.innerWidth / window.innerHeight;
const player = new Player(world, aspect);
const sky = new Sky(scene);
const held = new HeldItem(atlasTexture, aspect);
const ui = new UI();
const interaction = new Interaction(scene);
const input = new Input(renderer.domElement);
const chunks = new ChunkManager(world, scene, materials);

ui.buildHotbar(tiles);
held.setBlock(ui.selectedBlock);

// spawn the player above the surface near origin
player.spawn(0, 0);

// --- overlay / pointer lock ---
const overlayEl = document.getElementById('overlay')!;
const loadingEl = document.getElementById('loading')!;
const playBtn = document.getElementById('play')!;
playBtn.addEventListener('click', () => input.requestLock());
input.onLockChange = (locked) => {
  overlayEl.classList.toggle('hidden', locked);
};

// --- resource pack ---
const packInput = document.getElementById('packInput') as HTMLInputElement;
const packStatus = document.getElementById('packStatus')!;
packInput.addEventListener('change', async () => {
  if (!packInput.files || packInput.files.length === 0) return;
  packStatus.textContent = ' loading…';
  const res = await loadResourcePack(packInput.files, tiles);
  paintAtlas(atlasCanvas, tiles);
  atlasTexture.needsUpdate = true;
  ui.buildHotbar(tiles);
  packStatus.textContent = ` ${res.replaced}/${res.total} textures applied`;
});

// --- resize ---
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  player.camera.aspect = w / h;
  player.camera.updateProjectionMatrix();
  held.resize(w / h);
}
window.addEventListener('resize', onResize);

// --- frame loop ---
let last = performance.now();
let started = false; // becomes true once the spawn area is meshed
let fpsAccum = 0;
let fpsFrames = 0;
let fps = 0;

function selectFromInput() {
  if (!input.locked) return; // don't change selection while paused/overlay up
  for (let i = 1; i <= 9; i++) if (input.wasPressed('Digit' + i)) ui.setSelected(i - 1);
  const w = input.consumeWheel();
  if (w !== 0) ui.setSelected(ui.selected + w);
  held.setBlock(ui.selectedBlock);
}

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  input.setTime(now / 1000);

  // fps meter
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 0.5) {
    fps = Math.round(fpsFrames / fpsAccum);
    fpsAccum = 0;
    fpsFrames = 0;
    ui.updateFps(fps);
  }

  if (input.wasPressed('F3')) ui.toggleDebug();
  selectFromInput();

  const pcx = floorDiv(Math.floor(player.pos.x), CHUNK_SX);
  const pcz = floorDiv(Math.floor(player.pos.z), CHUNK_SZ);

  // stream chunks (always, so the world keeps loading even before play)
  chunks.update(pcx, pcz, started ? 8 : 16);

  // gate: keep "loading" until the spawn area is ready, then re-snap spawn
  if (!started) {
    if (chunks.readyAt(pcx, pcz)) {
      player.spawn(0, 0);
      started = true;
      loadingEl.classList.add('hidden');
      overlayEl.classList.remove('hidden');
    }
  }

  let swung = false;
  if (started && input.locked) {
    player.update(dt, input);
    swung = interaction.update(dt, input, player, world, ui.selectedBlock);
  } else {
    // keep camera oriented even while paused
    player.camera.rotation.y = player.yaw;
    player.camera.rotation.x = player.pitch;
    player.camera.position.copy(player.eyePosition);
  }

  sky.update(dt, player.camera.position);
  materials.setDayLight(sky.dayLight);
  held.update(dt, swung);

  renderer.render(scene, player.camera);
  held.render(renderer);

  if (ui.debugVisible) {
    ui.updateDebug({
      fps,
      x: player.pos.x,
      y: player.pos.y,
      z: player.pos.z,
      facing: player.facing(),
      chunkX: pcx,
      chunkZ: pcz,
      chunks: chunks.meshedCount,
      flying: player.flying,
      onGround: player.onGround,
    });
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Debug handle (handy in the console: e.g. __game.player.pos, __game.sky.time).
(window as any).__game = { player, world, input, interaction, ui, chunks, sky, renderer, held };
