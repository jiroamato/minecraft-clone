// ---------------------------------------------------------------------------
// Input: pointer-lock mouse look, held-key state, one-shot key presses, mouse
// buttons, scroll wheel, and double-tap detection (sprint / fly toggles).
// ---------------------------------------------------------------------------

export class Input {
  private held = new Set<string>();
  private justPressed = new Set<string>();
  private lastTap = new Map<string, number>();
  private doubleTapped = new Set<string>();

  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;

  leftHeld = false;
  rightHeld = false;
  leftJustPressed = false;
  rightJustPressed = false;

  locked = false;
  onLockChange: (locked: boolean) => void = () => {};
  // Fired when requestPointerLock() is rejected (e.g. Chrome's post-Esc
  // cooldown). Lets the UI recover instead of getting stuck unlocked.
  onLockError: () => void = () => {};

  private el: HTMLElement;
  private now = 0;

  constructor(el: HTMLElement) {
    this.el = el;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // Avoid the page scrolling on space etc. while playing.
      if (this.locked && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code))
        e.preventDefault();
      // F3 (debug toggle) is consumed unconditionally, so always suppress the
      // browser's Find-Next default.
      if (e.code === 'F3') e.preventDefault();
      this.held.add(e.code);
      this.justPressed.add(e.code);
      // double-tap detection
      const t = this.now;
      const prev = this.lastTap.get(e.code) ?? -1;
      if (prev >= 0 && t - prev < 0.3) this.doubleTapped.add(e.code);
      this.lastTap.set(e.code, t);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));

    this.el.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) {
        this.leftHeld = true;
        this.leftJustPressed = true;
      } else if (e.button === 2) {
        this.rightHeld = true;
        this.rightJustPressed = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.leftHeld = false;
      else if (e.button === 2) this.rightHeld = false;
    });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.locked) return;
        this.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) {
        this.held.clear();
        this.leftHeld = this.rightHeld = false;
        // drop any one-shot/double-tap state so it can't fire on the next lock
        this.justPressed.clear();
        this.doubleTapped.clear();
        this.lastTap.clear();
      }
      this.onLockChange(this.locked);
    });

    document.addEventListener('pointerlockerror', () => this.onLockError());
  }

  requestLock(): void {
    this.el.requestPointerLock();
  }

  setTime(t: number): void {
    this.now = t;
  }

  isDown(code: string): boolean {
    return this.held.has(code);
  }

  wasPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  consumeDoubleTap(code: string): boolean {
    if (this.doubleTapped.has(code)) {
      this.doubleTapped.delete(code);
      return true;
    }
    return false;
  }

  consumeMouse(): [number, number] {
    const d: [number, number] = [this.mouseDX, this.mouseDY];
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  consumeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** Clear per-frame one-shot state. Call at the very end of each frame. */
  endFrame(): void {
    this.justPressed.clear();
    this.leftJustPressed = false;
    this.rightJustPressed = false;
  }
}
