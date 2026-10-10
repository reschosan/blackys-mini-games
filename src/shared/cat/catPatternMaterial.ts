import * as THREE from 'three';
import {
  EYE_COLOR_HEX,
  FUR_COLOR_HEX,
  HETEROCHROMIA_EYE_COLORS,
  LUCKY_PATTERN_COLORS,
  patternUsesSecondaryColor,
  type CatAppearance,
  type CatPattern,
  type EyeColor,
  type ManeStyle,
} from '../config/catAppearance';
import type { CatFurConfig } from '../config/catFur';
import { CAT_MODEL } from '../config/catModel';

const MANE_TUNING: Readonly<Record<ManeStyle, (fur: CatFurConfig) => { readonly lengthFraction: number; readonly reach: number }>> = {
  none: () => ({ lengthFraction: 0, reach: 1 }),
  ruff: (fur) => ({ lengthFraction: fur.ruffLengthFraction, reach: fur.ruffReach }),
  lion: (fur) => ({ lengthFraction: fur.lionLengthFraction, reach: fur.lionReach }),
};

const PATTERN_MODE: Record<CatPattern, number> = {
  solid: 0,
  tabby: 1,
  bicolor: 2,
  lucky: 3,
};

function toGlslColor(hex: number): string {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  return `vec3(${r}, ${g}, ${b})`;
}

// Injected into the Lambert fragment shader so the pattern reads the mesh's
// own (skinned) local position instead of a UV/texture. uBoundsMin/uBoundsMax
// are the mesh's bind-pose bounding box, so "dorsal" and "belly" line up with
// the silhouette regardless of which model or scale is plugged in.
const CAT_PATTERN_GLSL = `
float catPatternNoise(vec3 p) {
  return sin(p.x * 5.1 + p.y * 1.7) + sin(p.z * 6.3 - p.x * 2.1);
}

float catPatchMask(vec3 unitPos, vec3 center, float radius) {
  // smoothstep(edge0, edge1, x) is undefined when edge0 == edge1 (radius 0) - GLSL doesn't
  // promise 0 there, so guard explicitly rather than ever call it with a degenerate range.
  if (radius <= 0.0) return 0.0;
  return smoothstep(radius, radius * 0.35, length(unitPos - center));
}

vec3 catPatternColor(vec3 localPos, vec3 primaryColor, vec3 secondaryColor, int patternMode, vec3 boundsMin, vec3 boundsMax) {
  vec3 unitPos = (localPos - boundsMin) / max(boundsMax - boundsMin, vec3(0.0001));

  // Belly/underside and paws read lighter on every cat; tabby stripes and calico ignore this.
  float underside = smoothstep(0.32, 0.05, unitPos.y);
  vec3 lightenedPrimary = mix(primaryColor, vec3(1.0), 0.32);
  vec3 basePrimary = mix(primaryColor, lightenedPrimary, underside * 0.85);

  if (patternMode == 1) {
    float dorsalMask = smoothstep(0.55, 0.82, unitPos.y);
    float stripe = sin(unitPos.x * 46.0 + unitPos.y * 16.0 + unitPos.z * 12.0);
    float stripeMask = smoothstep(0.15, 0.5, stripe) * dorsalMask;
    return mix(basePrimary, secondaryColor, stripeMask);
  }
  if (patternMode == 2) {
    float bellyMask = smoothstep(0.4, 0.1, unitPos.y);
    return mix(basePrimary, secondaryColor, bellyMask);
  }
  if (patternMode == 3) {
    vec3 base = ${toGlslColor(LUCKY_PATTERN_COLORS.base)};
    vec3 patchA = ${toGlslColor(LUCKY_PATTERN_COLORS.patchA)};
    vec3 patchB = ${toGlslColor(LUCKY_PATTERN_COLORS.patchB)};
    float maskA = max(
      catPatchMask(unitPos, vec3(0.35, 0.75, 0.65), 0.4),
      catPatchMask(unitPos, vec3(0.85, 0.85, 0.4), 0.32)
    );
    float maskB = max(
      catPatchMask(unitPos, vec3(0.6, 0.55, 0.3), 0.38),
      catPatchMask(unitPos, vec3(0.1, 0.6, 0.55), 0.3)
    );
    vec3 color = mix(base, patchA, maskA);
    return mix(color, patchB, maskB * (1.0 - maskA));
  }
  return basePrimary;
}

// Recolors a small patch around each eye joint's bind-pose position, overriding whatever the fur
// pattern computed there - the model has no separate eye mesh/material (see catModelLoader), so
// this is the only way to give the two eyes an independently chosen color.
vec3 catApplyEyeColors(vec3 furColor, vec3 unitPos, vec3 leftEyeCenter, vec3 rightEyeCenter, float radius, vec3 leftEyeColor, vec3 rightEyeColor) {
  float leftMask = catPatchMask(unitPos, leftEyeCenter, radius);
  float rightMask = catPatchMask(unitPos, rightEyeCenter, radius);
  vec3 result = mix(furColor, leftEyeColor, leftMask);
  return mix(result, rightEyeColor, rightMask);
}
`;

// Fur shells: the same cat geometry repeated once per layer, each copy pushed out along its
// normals (plus a little sag) and cut into strands, so the layers read as long hair. The face is
// kept short and the eyes are cut out so the cat's expression stays readable.
const FUR_SHELL_VERTEX_DECLARATIONS = `
attribute float aShellLayer;
varying float vShellLayer;
varying float vManeMask;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform float uShellThickness;
uniform float uShellDroop;
uniform float uShellFaceShortening;
uniform float uManeLength;
uniform float uManeReach;

// 0..1 over the neck and chest (a band behind the head) and in a ring around the face, so the face
// and the ears stay free (bounding-box unit space: x sideways, y up, z toward the face).
float catManeMask(vec3 unitPos, float reach) {
  float band = smoothstep(0.50 - 0.10 * reach, 0.64, unitPos.z) * (1.0 - smoothstep(0.74, 0.86, unitPos.z));
  float neckHeight = smoothstep(0.28 - 0.06 * reach, 0.48, unitPos.y) * (1.0 - smoothstep(0.80, 0.92, unitPos.y));
  vec3 fromFace = (unitPos - vec3(0.5, 0.74, 0.93)) * vec3(1.0, 0.85, 0.75);
  float faceDistance = length(fromFace);
  float ring = smoothstep(0.075, 0.17, faceDistance) * (1.0 - smoothstep(0.17 + 0.05 * reach, 0.32 + 0.05 * reach, faceDistance));
  float notEars = 1.0 - smoothstep(0.84, 0.95, unitPos.y);
  float inFront = smoothstep(0.72, 0.80, unitPos.z);
  return clamp(band * neckHeight + ring * inFront * notEars, 0.0, 1.0);
}`;

const FUR_SHELL_VERTEX_OFFSET = `
vShellLayer = aShellLayer;
vec3 shellUnit = (transformed - uBoundsMin) / max(uBoundsMax - uBoundsMin, vec3(0.0001));
float shellFaceMask = smoothstep(0.80, 0.93, shellUnit.z) * smoothstep(0.55, 0.7, shellUnit.y);
float shellLength = uShellThickness * (1.0 - uShellFaceShortening * shellFaceMask);
vManeMask = uManeLength > 0.0 ? catManeMask(shellUnit, uManeReach) : 0.0;
float hairLength = max(shellLength, uManeLength * vManeMask);
transformed += normalize(normal) * aShellLayer * hairLength;
transformed.y -= aShellLayer * aShellLayer * hairLength * uShellDroop * (1.0 - 0.6 * vManeMask);`;

const FUR_SHELL_FRAGMENT_DECLARATIONS = `
varying float vShellLayer;
varying float vManeMask;
uniform float uShellDensity;
uniform float uShellDarkening;
uniform float uShellThickness;
uniform float uManeTone;`;

const FUR_SHELL_FRAGMENT_CUTOUT = `
if (uShellThickness <= 0.0 && vManeMask < 0.04) discard;
vec3 shellCell = floor(vCatLocalPosition * uShellDensity);
float shellStrand = fract(sin(dot(shellCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
if (vShellLayer > mix(mix(0.3, 0.7, vManeMask), 1.0, shellStrand)) discard;
vec3 shellUnitPos = (vCatLocalPosition - uBoundsMin) / max(uBoundsMax - uBoundsMin, vec3(0.0001));
if (catPatchMask(shellUnitPos, uEyeLeftCenter, uEyeRadius * 1.7) > 0.0 || catPatchMask(shellUnitPos, uEyeRightCenter, uEyeRadius * 1.7) > 0.0) discard;
`;

const FUR_SHELL_FRAGMENT_SHADING = `
diffuseColor.rgb *= mix(1.0 - uShellDarkening, 1.0, vShellLayer);
diffuseColor.rgb *= mix(1.0, uManeTone, vManeMask);
diffuseColor.rgb *= 1.0 + 0.16 * vShellLayer * vManeMask;`;

export interface CatPatternBounds {
  readonly min: THREE.Vector3;
  readonly max: THREE.Vector3;
}

export interface CatPatternMaterial {
  readonly material: THREE.MeshLambertMaterial;
  setAppearance(appearance: CatAppearance): void;
  /** Hair length, droop, density and mane of a fur-shell material; no effect on the body material. */
  setFurTuning(fur: CatFurConfig, appearance: CatAppearance): void;
  dispose(): void;
}

function eyeColorHex(eyeColor: EyeColor, side: 0 | 1): number {
  if (eyeColor === 'heterochromia') return HETEROCHROMIA_EYE_COLORS[side];
  return EYE_COLOR_HEX[eyeColor];
}

let materialIdCounter = 0;
function nextMaterialId(): number {
  materialIdCounter += 1;
  return materialIdCounter;
}

/**
 * Recolors the model's baked gradient texture instead of replacing it outright: the texture is
 * reduced to luminance and multiplied by the target fur hue. This keeps shading details (nose, paw
 * pads, ambient-occlusion) intact across every fur color and pattern. The model has no separate eye
 * material to recolor the same way (see catModelLoader), so eyes are instead overridden by a small
 * position-based patch at the fixed, hand-calibrated spot from `CAT_MODEL.eyePatchPositions`.
 */
export function createCatPatternMaterial(
  appearance: CatAppearance,
  bounds: CatPatternBounds,
  baseMap: THREE.Texture | null,
  furShell = false,
): CatPatternMaterial {
  const uniforms = {
    uPrimaryColor: { value: new THREE.Color() },
    uSecondaryColor: { value: new THREE.Color() },
    uPatternMode: { value: 0 },
    uBoundsMin: { value: bounds.min.clone() },
    uBoundsMax: { value: bounds.max.clone() },
    uEyeLeftCenter: { value: new THREE.Vector3(...CAT_MODEL.eyePatchPositions.left) },
    uEyeRightCenter: { value: new THREE.Vector3(...CAT_MODEL.eyePatchPositions.right) },
    uEyeRadius: { value: CAT_MODEL.eyePatchRadius },
    uEyeColorLeft: { value: new THREE.Color() },
    uEyeColorRight: { value: new THREE.Color() },
    uShellThickness: { value: 0 },
    uShellDroop: { value: 0 },
    uShellDensity: { value: 1 },
    uShellFaceShortening: { value: 0 },
    uShellDarkening: { value: 0 },
    uManeLength: { value: 0 },
    uManeReach: { value: 1 },
    uManeTone: { value: 1 },
  };

  const material = new THREE.MeshLambertMaterial({ map: baseMap });
  // Must be unique per instance (and stable across calls): a shared key makes three.js reuse one
  // compiled program - and its baked-in uniform values - across every cat material using it, so
  // several cats created in the same frame (e.g. multiple AI karts) all end up rendering the first
  // one's fur color.
  const cacheKey = `cat-pattern-v5-${furShell ? 'shell' : 'body'}-${nextMaterialId()}`;
  material.customProgramCacheKey = () => cacheKey;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCatLocalPosition;${furShell ? FUR_SHELL_VERTEX_DECLARATIONS : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvCatLocalPosition = transformed;${furShell ? FUR_SHELL_VERTEX_OFFSET : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCatLocalPosition;
        uniform vec3 uPrimaryColor;
        uniform vec3 uSecondaryColor;
        uniform int uPatternMode;
        uniform vec3 uBoundsMin;
        uniform vec3 uBoundsMax;
        uniform vec3 uEyeLeftCenter;
        uniform vec3 uEyeRightCenter;
        uniform float uEyeRadius;
        uniform vec3 uEyeColorLeft;
        uniform vec3 uEyeColorRight;
        ${furShell ? FUR_SHELL_FRAGMENT_DECLARATIONS : ''}
        ${CAT_PATTERN_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        (furShell ? FUR_SHELL_FRAGMENT_CUTOUT : '') +
          (baseMap
            ? `#include <map_fragment>
        vec3 catUnitPos = (vCatLocalPosition - uBoundsMin) / max(uBoundsMax - uBoundsMin, vec3(0.0001));
        vec3 catTargetHue = catPatternColor(vCatLocalPosition, uPrimaryColor, uSecondaryColor, uPatternMode, uBoundsMin, uBoundsMax);
        float catLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = clamp(catLuma * 2.0 * catTargetHue, 0.0, 1.0);
        diffuseColor.rgb = catApplyEyeColors(diffuseColor.rgb, catUnitPos, uEyeLeftCenter, uEyeRightCenter, uEyeRadius, uEyeColorLeft, uEyeColorRight);`
            : `#include <map_fragment>
        vec3 catUnitPos = (vCatLocalPosition - uBoundsMin) / max(uBoundsMax - uBoundsMin, vec3(0.0001));
        diffuseColor.rgb = catPatternColor(vCatLocalPosition, uPrimaryColor, uSecondaryColor, uPatternMode, uBoundsMin, uBoundsMax);
        diffuseColor.rgb = catApplyEyeColors(diffuseColor.rgb, catUnitPos, uEyeLeftCenter, uEyeRightCenter, uEyeRadius, uEyeColorLeft, uEyeColorRight);`) +
          (furShell ? FUR_SHELL_FRAGMENT_SHADING : ''),
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // Soft, warm rim light so the silhouette reads as fuzzy fur, not glossy plastic.
        float catRim = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.2);
        totalEmissiveRadiance += vec3(1.0, 0.97, 0.92) * catRim * 0.07;`,
      );
  };

  const setAppearance = (nextAppearance: CatAppearance): void => {
    uniforms.uPrimaryColor.value.set(FUR_COLOR_HEX[nextAppearance.furColor]);
    uniforms.uSecondaryColor.value.set(
      FUR_COLOR_HEX[patternUsesSecondaryColor(nextAppearance.pattern) ? nextAppearance.patternSecondaryColor : nextAppearance.furColor],
    );
    uniforms.uPatternMode.value = PATTERN_MODE[nextAppearance.pattern];
    uniforms.uEyeColorLeft.value.set(eyeColorHex(nextAppearance.eyeColor, 0));
    uniforms.uEyeColorRight.value.set(eyeColorHex(nextAppearance.eyeColor, 1));
  };

  const setFurTuning = (fur: CatFurConfig, nextAppearance: CatAppearance): void => {
    const height = bounds.max.y - bounds.min.y;
    const mane = MANE_TUNING[nextAppearance.mane](fur);
    uniforms.uShellThickness.value = nextAppearance.hairLength === 'long' ? height * fur.lengthFraction : 0;
    uniforms.uShellDroop.value = fur.droopFraction / Math.max(fur.lengthFraction, 0.0001);
    uniforms.uShellDensity.value = fur.strandDensity / Math.max(height, 0.0001);
    uniforms.uShellFaceShortening.value = fur.faceShortening;
    uniforms.uShellDarkening.value = fur.rootDarkening;
    uniforms.uManeLength.value = height * mane.lengthFraction;
    uniforms.uManeReach.value = mane.reach;
    uniforms.uManeTone.value = fur.maneTone;
  };

  setAppearance(appearance);

  return {
    material,
    setAppearance,
    setFurTuning,
    dispose: () => material.dispose(),
  };
}
