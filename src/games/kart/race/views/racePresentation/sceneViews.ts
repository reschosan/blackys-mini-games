import * as THREE from 'three';

const CLEAR_COLOR = 0x101014;

/** Draws one scene with a camera per viewer, side by side or in four parts; without a scene or a camera the canvas is only cleared. */
export function drawScene(
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
  scene: THREE.Scene | null,
  cameras: readonly THREE.PerspectiveCamera[],
): void {
  renderer.setScissorTest(false);
  if (!scene || cameras.length === 0) {
    renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(CLEAR_COLOR);
    renderer.clear();
    return;
  }
  const columns = cameras.length === 1 ? 1 : 2;
  const rows = Math.ceil(cameras.length / columns);
  const width = Math.floor(canvas.clientWidth / columns);
  const height = Math.floor(canvas.clientHeight / rows);
  renderer.setScissorTest(true);
  renderer.clear();
  cameras.forEach((camera, index) => {
    const x = (index % columns) * width;
    const y = (rows - 1 - Math.floor(index / columns)) * height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setViewport(x, y, width, height);
    renderer.setScissor(x, y, width, height);
    renderer.render(scene, camera);
  });
  renderer.setScissorTest(false);
}
