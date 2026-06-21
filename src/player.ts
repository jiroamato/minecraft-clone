// ---------------------------------------------------------------------------
// Player: first-person camera, movement and voxel AABB collision using
// Minecraft's actual numbers. Walk/sprint/sneak/jump on the ground with light
// air control; F or double-tap-space toggles a Creative-style fly mode.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import type { World } from './world';
import { Input } from './input';
import { blockDef } from './blocks';

const WIDTH = 0.6;
const HALF = WIDTH / 2;
const HEIGHT = 1.8;
const EYE = 1.62;

const WALK = 4.317;
const SPRINT = 5.612;
const SNEAK = 1.295;
const FLY = 10.92;
const FLY_SPRINT = 21.0;

const GRAVITY = 32;
const JUMP_HEIGHT = 1.25;
const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT); // ~8.944 m/s

const GROUND_ACCEL = 60; // snappy
const AIR_ACCEL = 12; // slight air control
const SENS = 0.0022;

const FOV_BASE = 70;
const FOV_SPRINT = 75;

const EPS = 1e-3;

export class Player {
  camera: THREE.PerspectiveCamera;
  pos = new THREE.Vector3(); // feet centre
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;

  flying = false;
  onGround = false;
  sprinting = false;
  sneaking = false;

  private world: World;
  private targetFov = FOV_BASE;

  constructor(world: World, aspect: number) {
    this.world = world;
    this.camera = new THREE.PerspectiveCamera(FOV_BASE, aspect, 0.1, 1000);
    this.camera.rotation.order = 'YXZ';
  }

  get eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  getLookDir(target = new THREE.Vector3()): THREE.Vector3 {
    target.set(0, 0, -1).applyEuler(this.camera.rotation);
    return target;
  }

  spawn(x: number, z: number): void {
    const y = this.world.highestSolid(Math.floor(x), Math.floor(z)) + 1;
    this.pos.set(x + 0.5, y + 0.2, z + 0.5);
    this.vel.set(0, 0, 0);
  }

  private solidAt(x: number, y: number, z: number): boolean {
    const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return blockDef(id).solid;
  }

  // Is there a solid block touching the footprint just below the feet?
  private supported(px: number, pz: number): boolean {
    const y = this.pos.y - EPS - 0.02;
    const minX = px - HALF;
    const maxX = px + HALF;
    const minZ = pz - HALF;
    const maxZ = pz + HALF;
    for (let bx = Math.floor(minX); bx <= Math.floor(maxX); bx++)
      for (let bz = Math.floor(minZ); bz <= Math.floor(maxZ); bz++)
        if (this.solidAt(bx + 0.5, y, bz + 0.5)) return true;
    return false;
  }

  // Move one axis then resolve against the overlapping solids, snapping to the
  // nearest blocking face IN THE DIRECTION OF TRAVEL. Blocks behind the
  // pre-move leading edge are ignored, so a graze/penetration on the far side
  // can never snap the player backwards (axis-separated corner-catch). Other
  // axes are assumed already resolved (clear).
  private collideAxis(axis: 'x' | 'y' | 'z', amount: number): void {
    if (amount === 0) return;
    const before = this.pos[axis];
    this.pos[axis] += amount;

    // AABB extents on this axis: feet..head for y, +/-HALF for x/z.
    const lowExt = axis === 'y' ? 0 : HALF;
    const highExt = axis === 'y' ? HEIGHT : HALF;
    const lead = amount > 0 ? before + highExt : before - lowExt;

    const x0 = Math.floor(this.pos.x - HALF),
      x1 = Math.floor(this.pos.x + HALF - 1e-9);
    const y0 = Math.floor(this.pos.y),
      y1 = Math.floor(this.pos.y + HEIGHT - 1e-9);
    const z0 = Math.floor(this.pos.z - HALF),
      z1 = Math.floor(this.pos.z + HALF - 1e-9);

    let hit = false;
    let bound = 0; // chosen block coordinate on the moving axis
    for (let bx = x0; bx <= x1; bx++)
      for (let by = y0; by <= y1; by++)
        for (let bz = z0; bz <= z1; bz++) {
          if (!this.solidAt(bx + 0.5, by + 0.5, bz + 0.5)) continue;
          const coord = axis === 'x' ? bx : axis === 'y' ? by : bz;
          // keep only blocks ahead of the pre-move leading edge
          if (amount > 0 ? coord < lead - EPS : coord + 1 > lead + EPS) continue;
          if (!hit) {
            hit = true;
            bound = coord;
          } else {
            bound = amount > 0 ? Math.min(bound, coord) : Math.max(bound, coord);
          }
        }
    if (!hit) return;

    this.pos[axis] = amount > 0 ? bound - highExt - EPS : bound + 1 + lowExt + EPS;
    this.vel[axis] = 0;
    if (axis === 'y' && amount < 0) this.onGround = true;
  }

  update(dt: number, input: Input): void {
    // --- look ---
    const [dx, dy] = input.consumeMouse();
    this.yaw -= dx * SENS;
    this.pitch -= dy * SENS;
    const lim = Math.PI / 2 - 0.001;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));

    // --- toggles ---
    if (input.wasPressed('KeyF') || input.consumeDoubleTap('Space')) {
      this.flying = !this.flying;
      this.vel.y = 0;
    }

    this.sneaking = input.isDown('ShiftLeft') || input.isDown('ShiftRight');

    // --- desired horizontal movement in world space ---
    const forward = input.isDown('KeyW') ? 1 : 0;
    const back = input.isDown('KeyS') ? 1 : 0;
    const left = input.isDown('KeyA') ? 1 : 0;
    const right = input.isDown('KeyD') ? 1 : 0;
    let fwd = forward - back; // W = +1 (toward where you look)
    let strafe = right - left; // D = +1
    const len = Math.hypot(fwd, strafe);
    if (len > 0) {
      fwd /= len;
      strafe /= len;
    }

    // sprint logic
    const wantSprintKey = input.isDown('ControlLeft') || input.isDown('ControlRight');
    if ((wantSprintKey || input.consumeDoubleTap('KeyW')) && forward && !this.sneaking) this.sprinting = true;
    if (!forward || this.sneaking) this.sprinting = false;

    let speed: number;
    if (this.flying) speed = this.sprinting ? FLY_SPRINT : FLY;
    else if (this.sneaking) speed = SNEAK;
    else if (this.sprinting) speed = SPRINT;
    else speed = WALK;

    // Rotate input into world space using the camera's actual basis at this yaw:
    //   forward = (-sin, -cos),  right = (cos, -sin)   (x, z)
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wishX = strafe * cos - fwd * sin;
    const wishZ = -strafe * sin - fwd * cos;

    const targetVX = wishX * speed;
    const targetVZ = wishZ * speed;

    const accel = this.flying ? GROUND_ACCEL : this.onGround ? GROUND_ACCEL : AIR_ACCEL;
    this.vel.x += (targetVX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetVZ - this.vel.z) * Math.min(1, accel * dt);

    // --- vertical ---
    if (this.flying) {
      let vy = 0;
      if (input.isDown('Space')) vy += 1;
      if (this.sneaking) vy -= 1;
      this.vel.y = vy * speed;
    } else {
      if (this.onGround && input.isDown('Space')) {
        this.vel.y = JUMP_VELOCITY;
        this.onGround = false;
      }
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -60) this.vel.y = -60;
    }

    this.onGround = false;

    // --- integrate with collision, axis-separated and sub-stepped ---
    // Sub-step so a single collision step never moves more than ~half a block,
    // preventing tunnelling through thin geometry at high speed / large dt.
    const dxMove = this.vel.x * dt;
    const dyMove = this.vel.y * dt;
    const dzMove = this.vel.z * dt;
    const maxMove = Math.max(Math.abs(dxMove), Math.abs(dyMove), Math.abs(dzMove));
    const steps = Math.max(1, Math.ceil(maxMove / 0.45));
    const sxMove = dxMove / steps;
    const syMove = dyMove / steps;
    const szMove = dzMove / steps;
    const sneakProtect = this.sneaking && !this.flying;

    for (let s = 0; s < steps; s++) {
      this.collideAxis('y', syMove);

      // sneak edge protection: undo a horizontal step that walks off a ledge
      const beforeX = this.pos.x;
      this.collideAxis('x', sxMove);
      if (sneakProtect && this.onGround && !this.supported(this.pos.x, this.pos.z)) {
        this.pos.x = beforeX;
        this.vel.x = 0;
      }

      const beforeZ = this.pos.z;
      this.collideAxis('z', szMove);
      if (sneakProtect && this.onGround && !this.supported(this.pos.x, this.pos.z)) {
        this.pos.z = beforeZ;
        this.vel.z = 0;
      }
    }

    // --- camera ---
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    const eyeY = this.pos.y + EYE - (this.sneaking && this.onGround ? 0.08 : 0);
    this.camera.position.set(this.pos.x, eyeY, this.pos.z);

    // --- fov ---
    this.targetFov = this.sprinting ? FOV_SPRINT : FOV_BASE;
    if (Math.abs(this.camera.fov - this.targetFov) > 0.05) {
      this.camera.fov += (this.targetFov - this.camera.fov) * Math.min(1, 12 * dt);
      this.camera.updateProjectionMatrix();
    }
  }

  facing(): string {
    let yaw = ((this.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const deg = (yaw * 180) / Math.PI;
    // yaw 0 looks toward -Z (north). +yaw turns toward -X? account for our setup.
    // forward dir at yaw 0 is (0,0,-1). Compute compass from look vector.
    const dir = this.getLookDir();
    const ax = Math.abs(dir.x);
    const az = Math.abs(dir.z);
    let f: string;
    if (ax > az) f = dir.x > 0 ? 'east (+X)' : 'west (-X)';
    else f = dir.z > 0 ? 'south (+Z)' : 'north (-Z)';
    void deg;
    return f;
  }
}
