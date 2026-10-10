import * as THREE from 'three';
import type { MapConfig, WindowJump } from '../mapConfig';
import { routeElevationAt } from '../surface';
import { t } from '../../../../../shared/i18n';

export function addJumpMarkers(parent: THREE.Group, map: MapConfig): void {
  for (const jump of map.windowJumps ?? []) {
    const group = new THREE.Group();
    const yaw = jump.launchYaw ?? 0;
    group.position.set(jump.launchRect.x, routeElevationAt(map, jump.launchRect.x, jump.launchRect.z, jump.levelId) + 0.35, jump.launchRect.z);
    group.rotation.y = -yaw;
    group.userData.levelId = jump.levelId;
    group.userData.jumpMarker = jump.id;
    const span = Math.abs(Math.sin(yaw)) * jump.launchRect.width + Math.abs(Math.cos(yaw)) * jump.launchRect.depth;
    const markings = map.jumpMarkings;
    const length = markings?.approachLength ?? 14;
    for (let distance = 0; distance <= length; distance += markings?.stripeSpacing ?? 3) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(markings?.stripeDepth ?? 0.8, span),
        new THREE.MeshBasicMaterial({ color: markings?.color ?? 0x56c4df, side: THREE.DoubleSide }),
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.x = (jump.takeoffOffset ?? 0) - distance;
      group.add(stripe);
    }
    if (jump.optional) addLaunchRamp(group, jump, span);
    addTakeoffSign(group, jump);
    parent.add(group);
  }
}

function addLaunchRamp(group: THREE.Group, jump: WindowJump, span: number): void {
  const geometry = new THREE.BufferGeometry();
  const end = jump.takeoffOffset ?? 0;
  const length = jump.rampLength ?? 4;
  const height = jump.rampHeight ?? 0.65;
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([end - length, 0, -span / 2, end, height, -span / 2, end - length, 0, span / 2, end, height, span / 2], 3),
  );
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x56c4df, side: THREE.DoubleSide, roughness: 0.8 })));
}

function addTakeoffSign(group: THREE.Group, jump: WindowJump): void {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#123a43';
  context.fillRect(0, 0, 512, 160);
  context.fillStyle = '#8feeff';
  context.font = 'bold 58px sans-serif';
  context.textAlign = 'center';
  context.fillText(jump.optional && jump.hasItem !== false ? t().race.itemJumpSign : t().race.jumpSign, 256, 66);
  context.font = 'bold 34px sans-serif';
  context.fillText(t().race.jumpSignSpeed(jump.minimumSpeed), 256, 125);
  const texture = new THREE.CanvasTexture(canvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(jump.optional ? 5 : 8, jump.optional ? 1.6 : 2.5),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  sign.rotation.y = -Math.PI / 2;
  sign.position.set((jump.takeoffOffset ?? 0) - 2, jump.optional ? 4 : 5, jump.optional ? -4.8 : 0);
  sign.userData.ownsTexture = true;
  group.add(sign);
}
