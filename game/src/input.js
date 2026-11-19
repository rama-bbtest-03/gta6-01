// Keyboard + mouse input state. Mouse drag orbits the camera; click shoots.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseDown: false,
    clicked: false,          // consumed once per frame by the shooter
    dragDX: 0, dragDY: 0,    // accumulated drag deltas, consumed by the camera
    dragging: false,
    isDown(code) { return keys.has(code); },
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    input._pressed = input._pressed || new Set();
    input._pressed.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true; input.dragging = true;
    input._lastX = e.clientX; input._lastY = e.clientY;
    input._downAt = performance.now();
  });
  window.addEventListener('mouseup', (e) => {
    input.mouseDown = false; input.dragging = false;
    if (input._downAt && performance.now() - input._downAt < 220 &&
        Math.abs(e.clientX - (input._downX ?? e.clientX)) < 6) input.clicked = true;
    input._downAt = 0;
  });
  canvas.addEventListener('mousedown', (e) => { input._downX = e.clientX; });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.dragDX += e.clientX - input._lastX;
    input.dragDY += e.clientY - input._lastY;
    input._lastX = e.clientX; input._lastY = e.clientY;
  });
  // pressed() is true only on the frame the key went down.
  input.pressed = function pressed(code) {
    return !!(input._pressed && input._pressed.has(code));
  };
  input.endFrame = function endFrame() {
    input._pressed = new Set();
    input.dragDX = 0; input.dragDY = 0;
    input.clicked = false;
  };
  return input;
}
