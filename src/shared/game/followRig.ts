import * as THREE from 'three';
import { createRuntimeCamera } from '../config/camera';
import { smoothAngleTowards, smoothTowards } from '../core/framing';

/** The camera of the kart race for games with their own scene: behind the subject, tilted down by the same angle, at the same distance and
 *  with the same easing. `yaw` is the direction the camera looks in (0 looks towards -z, a turn to the right is positive). */
export class FollowRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly follow = createRuntimeCamera().follow;
  private readonly target = new THREE.Vector3();
  private shownYaw = 0;
  private started = false;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(this.follow.fov, 1, 0.1, 600);
  }

  place(x: number, y: number, z: number, yaw: number, frameSeconds: number): void {
    const { follow, target } = this;
    if (!this.started) {
      this.started = true;
      target.set(x, y, z);
      this.shownYaw = yaw;
    }
    this.shownYaw = smoothAngleTowards(this.shownYaw, yaw, follow.positionSmoothing, frameSeconds);
    target.set(
      smoothTowards(target.x, x, follow.targetSmoothing, frameSeconds),
      smoothTowards(target.y, y, follow.targetSmoothing, frameSeconds),
      smoothTowards(target.z, z, follow.targetSmoothing, frameSeconds),
    );
    const pitch = (follow.pitchDegrees * Math.PI) / 180;
    const back = Math.cos(pitch) * follow.thirdPersonDistance;
    this.camera.position.set(
      target.x - Math.sin(this.shownYaw) * back,
      target.y + Math.sin(pitch) * follow.thirdPersonDistance,
      target.z + Math.cos(this.shownYaw) * back,
    );
    this.camera.lookAt(target);
  }
}
