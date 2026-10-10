export type PlaneTypeId = 'jet' | 'flitzer' | 'ufo' | 'liner';

export const PLANE_TYPES: readonly PlaneTypeId[] = ['jet', 'flitzer', 'ufo', 'liner'];

export const DEFAULT_PLANE_TYPE: PlaneTypeId = 'jet';

/** The model of each plane (`public/models/space-pack`, Quaternius, CC0) how long it is drawn (metres) and how far it is turned so that its nose points along +x. */
export const PLANE_MODELS: Readonly<Record<PlaneTypeId, { readonly file: string; readonly length: number; readonly turn: number }>> = {
  jet: { file: 'Spaceship.glb', length: 7, turn: Math.PI / 2 },
  flitzer: { file: 'Spaceship-Jqfed124pQ.glb', length: 7.5, turn: Math.PI / 2 },
  ufo: { file: 'Spaceship-u105mYHLHU.glb', length: 6, turn: Math.PI / 2 },
  liner: { file: 'Spaceship-VSxUAFhzbA.glb', length: 8.5, turn: Math.PI / 2 },
};

export function isPlaneType(value: unknown): value is PlaneTypeId {
  return typeof value === 'string' && (PLANE_TYPES as readonly string[]).includes(value);
}
