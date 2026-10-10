import * as THREE from 'three';
import type { MapConfig, MapLighting } from '../mapConfig';
import { DEFAULT_LIGHTING } from '../mapDefaults';

export interface LightRig {
  readonly hemisphere: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
}

/** `daylight`: light the map like day whatever its own light is, so a night map is still recognisable in a small preview. */
export function createLightRig(map: MapConfig, daylight = false): LightRig {
  const hemisphere = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.position.set(12, 20, 8);
  const rig = { hemisphere, sun };
  applyLighting(daylight ? undefined : map.lighting, rig);
  return rig;
}

/** Sets the lights to the map's own light (or daylight), also when the map of a running scene changes. */
export function applyMapLighting(map: MapConfig, rig: LightRig): void {
  applyLighting(map.lighting, rig);
}

function applyLighting(lighting: MapLighting | undefined, rig: LightRig): void {
  const { hemisphereSky, hemisphereGround, hemisphereIntensity, sunColor, sunIntensity } = lighting ?? DEFAULT_LIGHTING;
  rig.hemisphere.color.set(hemisphereSky);
  rig.hemisphere.groundColor.set(hemisphereGround);
  rig.hemisphere.intensity = hemisphereIntensity;
  rig.sun.color.set(sunColor);
  rig.sun.intensity = sunIntensity;
}
