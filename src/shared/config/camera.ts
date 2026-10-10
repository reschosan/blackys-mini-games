type CameraMode = 'follow' | 'overview';

interface FollowCameraConfig {
  fov: number;
  pitchDegrees: number;
  minDistance: number;
  maxDistance: number;
  framingMargin: number;
  lookAheadDistance: number;
  thirdPersonDistance: number;
  ceilingClearance: number;
  positionSmoothing: number;
  targetSmoothing: number;
  zoomSmoothing: number;
  zoomOutSmoothing: number;
}

interface OverviewCameraConfig {
  fov: number;
  height: number;
  backOffset: number;
}

export interface CameraConfig {
  mode: CameraMode;
  follow: FollowCameraConfig;
  overview: OverviewCameraConfig;
}

const DEFAULT_CAMERA: Readonly<CameraConfig> = Object.freeze({
  mode: 'follow',
  follow: {
    fov: 50,
    pitchDegrees: 20,
    minDistance: 16,
    maxDistance: 46,
    framingMargin: 6,
    lookAheadDistance: 2.5,
    thirdPersonDistance: 24,
    ceilingClearance: 1.2,
    positionSmoothing: 6,
    targetSmoothing: 8,
    zoomSmoothing: 3,
    zoomOutSmoothing: 8,
  },
  overview: {
    fov: 50,
    height: 40,
    backOffset: 32,
  },
} satisfies CameraConfig);

export function createRuntimeCamera(): CameraConfig {
  return {
    mode: DEFAULT_CAMERA.mode,
    follow: { ...DEFAULT_CAMERA.follow },
    overview: { ...DEFAULT_CAMERA.overview },
  };
}

export function resetRuntimeCamera(target: CameraConfig): void {
  Object.assign(target, createRuntimeCamera());
}
