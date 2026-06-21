// ---------------------------------------------------------------------------
// First-person held item in the bottom-right, rendered as a separate overlay
// scene/camera (cleared depth) so it never clips into the world. Blocks render
// as a skinned cube; tools render as a flat textured sprite plane. Swings on
// click / while breaking.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { BlockId, blockDef, RenderLayer } from './blocks';
import { Item, itemKey } from './items';
import { tileUV, makeToolTexture } from './textures';

const SWING_DUR = 0.28;
const FACE_SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8]; // +x,-x,+y,-y,+z,-z

export class HeldItem {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private cube: THREE.Mesh;
  private cubeGeom: THREE.BoxGeometry;
  private cubeMat: THREE.MeshBasicMaterial;
  private baseUV!: Float32Array; // pristine 0/1 box UVs to remap from
  private plane: THREE.Mesh;
  private planeMat: THREE.MeshBasicMaterial;
  private kind: 'block' | 'tool' = 'block';
  private currentKey = ''; // itemKey of the current item; skip redundant reskins
  private phase = 0; // 0 == idle, (0,1] == mid-swing

  constructor(atlas: THREE.Texture, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 10);
    this.camera.position.set(0, 0, 0);

    // Block cube. Opaque by default; skinBlock() switches to transparent +
    // DoubleSide only for see-through blocks (glass) so opaque blocks aren't
    // double-drawn.
    this.cubeMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true });
    this.cubeGeom = new THREE.BoxGeometry(1, 1, 1);
    // snapshot the original 0/1 UVs so re-skinning always maps from a clean base
    this.baseUV = (this.cubeGeom.getAttribute('uv').array as Float32Array).slice();
    this.cube = new THREE.Mesh(this.cubeGeom, this.cubeMat);
    this.cube.scale.setScalar(0.42);
    this.scene.add(this.cube);

    // Tool sprite plane. Alpha-tested so the transparent sprite background is
    // cut out; DoubleSide so it shows during the swing rotation.
    this.planeMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.planeMat);
    this.plane.scale.setScalar(0.5);
    this.plane.visible = false;
    this.scene.add(this.plane);
  }

  setItem(item: Item): void {
    const key = itemKey(item);
    if (key === this.currentKey) return;
    this.currentKey = key;
    if (item.kind === 'block') {
      this.kind = 'block';
      this.cube.visible = true;
      this.plane.visible = false;
      this.skinBlock(item.block);
    } else {
      this.kind = 'tool';
      this.cube.visible = false;
      this.plane.visible = true;
      this.planeMat.map = makeToolTexture(item.tool, item.tier);
      this.planeMat.needsUpdate = true;
    }
  }

  private skinBlock(id: BlockId): void {
    const def = blockDef(id);
    // see-through blocks (glass) need alpha blending + both sides; opaque blocks
    // stay single-sided/opaque so the held draw isn't doubled.
    const seeThrough = def.layer !== RenderLayer.Opaque;
    this.cubeMat.transparent = seeThrough;
    this.cubeMat.side = seeThrough ? THREE.DoubleSide : THREE.FrontSide;
    this.cubeMat.needsUpdate = true;
    const uv = this.cubeGeom.getAttribute('uv') as THREE.BufferAttribute;
    const colors = new Float32Array(24 * 3);
    for (let face = 0; face < 6; face++) {
      const [u0, v0, u1, v1] = tileUV(def.faces[face]);
      for (let v = 0; v < 4; v++) {
        const i = face * 4 + v;
        // remap from the pristine base UVs (0/1), never the current (already
        // atlas-mapped) values — otherwise each switch shrinks the tile region.
        const ou = this.baseUV[i * 2];
        const ov = this.baseUV[i * 2 + 1];
        uv.setXY(i, u0 + ou * (u1 - u0), v0 + ov * (v1 - v0));
        const s = FACE_SHADE[face];
        colors[i * 3] = s;
        colors[i * 3 + 1] = s;
        colors[i * 3 + 2] = s;
      }
    }
    uv.needsUpdate = true;
    this.cubeGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  update(dt: number, swinging: boolean): void {
    if (this.phase > 0) {
      this.phase += dt / SWING_DUR;
      if (this.phase >= 1) this.phase = swinging ? this.phase - 1 : 0;
    } else if (swinging) {
      this.phase = 0.0001;
    }

    const swing = Math.sin(this.phase * Math.PI); // 0..1..0
    if (this.kind === 'block') {
      // resting pose: lower-right, slightly tilted into view
      const baseX = 0.62;
      const baseY = -0.52;
      const baseZ = -1.0;
      this.cube.position.set(baseX - swing * 0.12, baseY - swing * 0.22, baseZ + swing * 0.18);
      this.cube.rotation.set(0.18 + swing * 0.5, -0.5 - swing * 0.6, 0.1);
    } else {
      // flat sprite: the tool art is already drawn on a lower-left→upper-right
      // diagonal, so only a small tilt is needed; swing lifts and rotates it.
      const baseX = 0.3;
      const baseY = -0.3;
      const baseZ = -0.9;
      this.plane.position.set(baseX - swing * 0.06, baseY - swing * 0.22, baseZ + swing * 0.08);
      this.plane.rotation.set(swing * 0.4, -0.1, -0.1 - swing * 0.45);
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer): void {
    const prev = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = prev;
  }
}
