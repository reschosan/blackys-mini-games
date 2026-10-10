import * as THREE from 'three';

const MAX_SHOTS = 96;
const BOX_COLOR = 0xffd24a;
const MAX_BOXES = 24;

type Row = readonly number[];

/** What flies and floats in the room besides the planes: the shots (rockets bigger and orange) and the item boxes that turn and bob. */
export class JetEffects {
  private readonly shots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1a8 }), MAX_SHOTS);
  private readonly rockets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a3a }), MAX_SHOTS);
  private readonly boxes: THREE.Mesh[];
  private readonly boxMaterial = new THREE.MeshLambertMaterial({ color: BOX_COLOR, emissive: BOX_COLOR, emissiveIntensity: 0.5 });
  private readonly boxGeometry = new THREE.BoxGeometry(3, 3, 3);
  private readonly matrix = new THREE.Matrix4();
  private spin = 0;

  constructor(scene: THREE.Scene) {
    this.shots.count = 0;
    this.rockets.count = 0;
    // The instances move all over the room; a bounding sphere around the origin would hide them whenever the camera looks elsewhere.
    this.shots.frustumCulled = false;
    this.rockets.frustumCulled = false;
    scene.add(this.shots, this.rockets);
    this.boxes = Array.from({ length: MAX_BOXES }, () => {
      const box = new THREE.Mesh(this.boxGeometry, this.boxMaterial);
      box.visible = false;
      scene.add(box);
      return box;
    });
  }

  /** `shots` are `[x, z, y, rocket]`, `pickups` are `[x, z, y, inTheAir]`. */
  show(shots: readonly Row[], pickups: readonly Row[], frameSeconds: number): void {
    let plain = 0;
    let rockets = 0;
    for (const shot of shots.slice(0, MAX_SHOTS)) {
      this.matrix.makeTranslation(shot[0]!, shot[2]!, shot[1]!);
      if (shot[3] === 1) this.rockets.setMatrixAt(rockets++, this.matrix);
      else this.shots.setMatrixAt(plain++, this.matrix);
    }
    this.shots.count = plain;
    this.rockets.count = rockets;
    this.shots.instanceMatrix.needsUpdate = true;
    this.rockets.instanceMatrix.needsUpdate = true;
    this.showBoxes(pickups, frameSeconds);
  }

  dispose(): void {
    for (const mesh of [this.shots, this.rockets]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.boxGeometry.dispose();
    this.boxMaterial.dispose();
  }

  /** The boxes look the same: what is in one is only known once somebody takes it. */
  private showBoxes(pickups: readonly Row[], frameSeconds: number): void {
    this.spin += frameSeconds;
    this.boxes.forEach((box, index) => {
      const row = pickups[index];
      box.visible = row !== undefined && row[3] === 1;
      if (!row) return;
      box.position.set(row[0]!, row[2]! + Math.sin(this.spin * 2 + index) * 0.6, row[1]!);
      box.rotation.set(this.spin * 0.7, this.spin * 1.4, 0);
    });
  }
}
