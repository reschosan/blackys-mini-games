import type * as THREE from 'three';
import type { EngineSnapshot } from './engine';

/** How a game that is not on the kart engine is drawn, on the host and on every guest phone. It only reads snapshots and never writes into a game. */
export interface EngineView {
  /** Builds its DOM (a memory board, the marks over a 3D scene) inside `root`. */
  mount(root: HTMLElement): void;
  /** Takes over what the host reports. */
  apply(snapshot: EngineSnapshot): void;
  /** Once per drawn frame; `viewers` are the seats that look at the picture on this screen (empty when only AI plays on the host). */
  frame(frameSeconds: number, viewers: readonly number[]): void;
  /** The scene to draw, or null for a game that is only DOM. */
  readonly scene: THREE.Scene | null;
  /** One camera per viewer: the seats that look at the scene, each in its own part of the screen. */
  camerasFor(seats: readonly number[]): readonly THREE.PerspectiveCamera[];
  dispose(): void;
}
