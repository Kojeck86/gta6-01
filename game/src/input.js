// Keyboard and mouse. One clear job: turn raw DOM events into the small
// state object the simulation reads every frame — nothing else reads the
// keyboard directly.

// The live input state. `pressed` fires once per key press (edge-triggered);
// the game clears it each frame after reading it.
export class Input {
  constructor(canvas) {
    this.up = false;
    this.down = false;
    this.left = false;
    this.right = false;
    this.run = false;
    this.handbrake = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.pressed = new Set();
    this.keys = new Set();
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.sync();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.sync();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.sync();
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
  }

  sync() {
    this.up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    this.down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    this.left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    this.right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    this.run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.handbrake = this.keys.has('Space');
  }

  // Was this key pressed since the last frame? (Edge trigger.)
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // The game calls this once per frame, after reading `pressed`.
  endFrame() {
    this.pressed.clear();
  }
}
