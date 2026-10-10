export interface KartDimensions {
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly colliderScale: number;

  readonly wheelRadius: number;
  readonly wheelThickness: number;
  readonly wheelInset: number;

  readonly stripeLengthFactor: number;
  readonly stripeWidthFactor: number;
  readonly stripeHeight: number;

  readonly beltRollerRadius: number;
  readonly beltTreadBarCount: number;
  readonly beltTreadBarWidth: number;
  readonly beltTreadBarHeight: number;
}

export const KART_DIMENSIONS: KartDimensions = {
  length: 1.8,
  width: 1.2,
  height: 0.7,
  colliderScale: 0.95,

  wheelRadius: 0.26,
  wheelThickness: 0.16,
  wheelInset: 0.62,

  stripeLengthFactor: 0.82,
  stripeWidthFactor: 0.32,
  stripeHeight: 0.02,

  beltRollerRadius: 0.05,
  beltTreadBarCount: 7,
  beltTreadBarWidth: 0.025,
  beltTreadBarHeight: 0.012,
};

export const KART_COLLIDER_RADIUS = (KART_DIMENSIONS.length / 2) * KART_DIMENSIONS.colliderScale;

export const KART_WALL_COLLIDER_RADIUS = Math.hypot(KART_DIMENSIONS.length / 2, KART_DIMENSIONS.width / 2 + KART_DIMENSIONS.wheelThickness);
