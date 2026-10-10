export const SPACE_MODEL_DIRECTORY = 'models/space-pack';

const SPACE_ROCKS = ['Rock', 'Rock-34W5ymEePk', 'Rock-R2UjZAX3By', 'Rock-b7gRkv0cEa'] as const;
const SPACE_BIG_ROCKS = ['Rock Large', 'Rock Large-d2VWOdthtR', 'Rock Large-li0YBlBEMz'] as const;
const SPACE_FLORA = [
  'Plant',
  'Plant-VwXvoIpCHP',
  'Plant-s0joFFrQoy',
  'Bush',
  'Bush-RfUP3gXj69',
  'Bush-tX1aT9IB1P',
  'Grass',
  'Grass-Db4UVcNWnF',
  'Grass-iw6l7gqcdQ',
] as const;
const SPACE_ALIEN_TREES = [
  'Tree Blob',
  'Tree Blob-QHYRrAnKzW',
  'Tree Blob-j0byyoIGOv',
  'Tree Floating',
  'Tree Floating-sdtjU7iczl',
  'Tree Floating-tj2fePl8Eu',
  'Tree Lava',
  'Tree Lava-9gRfmVKx9W',
  'Tree Lava-sTYjmQObr1',
  'Tree Light',
  'Tree Light-om4BJAL82T',
  'Tree Spikes',
  'Tree Spikes-a6Vo1seJw9',
  'Tree Spiral',
  'Tree Spiral-gI3kqnqg80',
  'Tree Spiral-kBomlgZ5xu',
  'Tree Swirl',
  'Tree Swirl-iLxXSXIx2t',
] as const;
const SPACE_SOLAR = ['Solar Panel', 'Solar Panel Ground', 'Solar Panel Structure'] as const;
const SPACE_CRATES = ['Pickup Crate', 'Pickup Jar', 'Pickup Sphere', 'Pickup Health', 'Pickup Thunder', 'Pickup Key Card', 'Bullets Pickup'] as const;
const SPACE_SPACESHIPS = ['Spaceship', 'Spaceship-Jqfed124pQ', 'Spaceship-VSxUAFhzbA', 'Spaceship-u105mYHLHU'] as const;
const SPACE_PLANETS = [
  'Planet',
  'Planet-18Uxrb2dIc',
  'Planet-4NxxeyYMPJ',
  'Planet-5zzi8WUMXj',
  'Planet-9g1aIbfR9Y',
  'Planet-B7xd3SZq0z',
  'Planet-EC1Lk2IamI',
  'Planet-IVnmauIgWX',
  'Planet-hKZtOOMadH',
  'Planet-pHZz4EMvVM',
  'Planet-rYguWNNPvA',
] as const;
const SPACE_CHARACTERS = [
  'Astronaut',
  'Astronaut-0D54W8yfrA',
  'Astronaut-OgeSH89Nmx',
  'Mech',
  'Mech-4UvIHxnoSR',
  'Mech-D5wW2jDO42',
  'Mech-o3Ps8z8ByP',
  'Enemy Small',
  'Enemy Large',
  'Enemy Flying',
] as const;
const SPACE_VEHICLES = ['Rover', 'Rover-WRd1piJOfh', 'Round Rover'] as const;
const SPACE_BUILDINGS = [
  'Base Large',
  'Building L',
  'Geodesic Dome',
  'House Cylinder',
  'House Long',
  'House Open',
  'House Pod',
  'House Single',
  'House Single Support',
  'Connector',
  'Metal Support',
  'Roof Antenna',
  'Roof Radar',
  'Stairs',
  'Ramp',
] as const;

export const SPACE_ALL_MODELS: readonly string[] = [
  ...SPACE_ROCKS,
  ...SPACE_BIG_ROCKS,
  ...SPACE_FLORA,
  ...SPACE_ALIEN_TREES,
  ...SPACE_SOLAR,
  ...SPACE_CRATES,
  ...SPACE_SPACESHIPS,
  ...SPACE_PLANETS,
  ...SPACE_CHARACTERS,
  ...SPACE_VEHICLES,
  ...SPACE_BUILDINGS,
];

export interface SpaceScatterGroup {
  readonly assets: readonly string[];
  readonly weight: number;
  readonly scale: number;
  readonly clearanceMeters: number;
}

/** Cell size and share of cells that receive a prop; groups are picked by weight. */
export const SPACE_SCATTER = {
  cellMeters: 11,
  fillShare: 0.21,
  extentMeters: { west: 130, east: 130, north: 130, south: 130 },
  groups: [
    { assets: SPACE_ROCKS, weight: 44, scale: 1.5, clearanceMeters: 9 },
    { assets: SPACE_FLORA, weight: 26, scale: 1.8, clearanceMeters: 9 },
    { assets: SPACE_ALIEN_TREES, weight: 13, scale: 2.2, clearanceMeters: 16 },
    { assets: SPACE_BIG_ROCKS, weight: 8, scale: 2.4, clearanceMeters: 16 },
    { assets: SPACE_SOLAR, weight: 4, scale: 2, clearanceMeters: 12 },
    { assets: SPACE_CRATES, weight: 5, scale: 2.2, clearanceMeters: 9 },
  ] satisfies readonly SpaceScatterGroup[],
} as const;

export interface SpaceLandmark {
  readonly asset: string;
  readonly x: number;
  readonly z: number;
  readonly yawDegrees: number;
  readonly scale: number;
  /** Ground footprint radius in metres, used to keep landmarks off the course. */
  readonly radius: number;
}

export const SPACE_LANDMARKS: readonly SpaceLandmark[] = [
  { asset: 'Base Large', x: -238, z: -55, yawDegrees: 90, scale: 2.6, radius: 13 },
  { asset: 'Geodesic Dome', x: -238, z: 28, yawDegrees: 0, scale: 2.5, radius: 13 },
  { asset: 'House Pod', x: -262, z: -12, yawDegrees: 90, scale: 1.4, radius: 20 },
  { asset: 'Connector', x: -214, z: -14, yawDegrees: 90, scale: 2.2, radius: 5 },
  { asset: 'Roof Radar', x: -238, z: -90, yawDegrees: 20, scale: 3.2, radius: 4 },
  { asset: 'Roof Antenna', x: -214, z: 60, yawDegrees: 0, scale: 3.4, radius: 3 },
  { asset: 'Building L', x: 22, z: -205, yawDegrees: 0, scale: 2.6, radius: 11 },
  { asset: 'House Cylinder', x: -30, z: -215, yawDegrees: 0, scale: 2.6, radius: 8 },
  { asset: 'House Long', x: 80, z: -212, yawDegrees: 90, scale: 2.4, radius: 10 },
  { asset: 'Metal Support', x: 50, z: -190, yawDegrees: 0, scale: 3, radius: 4 },
  { asset: 'Stairs', x: 8, z: -186, yawDegrees: 180, scale: 2.4, radius: 4 },
  { asset: 'Ramp', x: 140, z: -190, yawDegrees: 180, scale: 2.4, radius: 4 },
  { asset: 'House Open', x: 160, z: -215, yawDegrees: 0, scale: 2.6, radius: 7 },
  { asset: 'House Single', x: 280, z: -70, yawDegrees: 270, scale: 2.6, radius: 7 },
  { asset: 'House Single Support', x: 282, z: -30, yawDegrees: 0, scale: 2.8, radius: 6 },
  { asset: 'Solar Panel Structure', x: 285, z: 40, yawDegrees: 270, scale: 3.4, radius: 8 },
  { asset: 'Solar Panel Structure', x: 285, z: 75, yawDegrees: 270, scale: 3.4, radius: 8 },
  { asset: 'Solar Panel', x: 262, z: 110, yawDegrees: 250, scale: 3.6, radius: 6 },
  { asset: 'Solar Panel Ground', x: 240, z: 170, yawDegrees: 200, scale: 3.4, radius: 5 },
  { asset: 'Rover', x: 250, z: 160, yawDegrees: 215, scale: 2, radius: 6 },
  { asset: 'Rover-WRd1piJOfh', x: -60, z: 190, yawDegrees: 20, scale: 2, radius: 7 },
  { asset: 'Round Rover', x: 150, z: 185, yawDegrees: 340, scale: 2, radius: 7 },
  { asset: 'Solar Panel Structure', x: -180, z: 170, yawDegrees: 20, scale: 3.4, radius: 8 },
  { asset: 'Solar Panel', x: -150, z: 195, yawDegrees: 350, scale: 3.6, radius: 6 },
  { asset: 'Solar Panel Ground', x: 30, z: 205, yawDegrees: 0, scale: 3.4, radius: 5 },
];

export interface SpaceCharacter {
  readonly asset: string;
  readonly x: number;
  readonly z: number;
  readonly lookAtX: number;
  readonly lookAtZ: number;
  readonly clip: string;
  readonly scale: number;
  readonly hoverHeight?: number;
}

export const SPACE_CHARACTER_PLACEMENTS: readonly SpaceCharacter[] = [
  { asset: 'Astronaut', x: 252, z: 62, lookAtX: 220, lookAtZ: 62, clip: 'Wave', scale: 1.7 },
  { asset: 'Astronaut-0D54W8yfrA', x: 252, z: -18, lookAtX: 220, lookAtZ: -18, clip: 'Yes', scale: 1.7 },
  { asset: 'Astronaut-OgeSH89Nmx', x: 60, z: -160, lookAtX: 60, lookAtZ: -125, clip: 'Wave', scale: 1.7 },
  { asset: 'Mech', x: -178, z: -150, lookAtX: -145, lookAtZ: -125, clip: 'Dance', scale: 1.9 },
  { asset: 'Mech-4UvIHxnoSR', x: 20, z: 158, lookAtX: 20, lookAtZ: 125, clip: 'Hello', scale: 1.9 },
  { asset: 'Mech-D5wW2jDO42', x: -110, z: 156, lookAtX: -100, lookAtZ: 125, clip: 'Idle', scale: 1.9 },
  { asset: 'Mech-o3Ps8z8ByP', x: 118, z: 162, lookAtX: 118, lookAtZ: 125, clip: 'Dance', scale: 1.9 },
  { asset: 'Enemy Large', x: -178, z: 5, lookAtX: -145, lookAtZ: 5, clip: 'Wave', scale: 1.9 },
  { asset: 'Enemy Small', x: 150, z: -158, lookAtX: 130, lookAtZ: -125, clip: 'Flying_Idle', scale: 2.2, hoverHeight: 7 },
  { asset: 'Enemy Flying', x: -60, z: -158, lookAtX: -60, lookAtZ: -125, clip: 'Flying_Idle', scale: 2.2, hoverHeight: 9 },
];

export interface SpacePlanetPlacement {
  readonly asset: string;
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly distanceMeters: number;
  readonly diameterMeters: number;
}

export const SPACE_PLANET_PLACEMENTS: readonly SpacePlanetPlacement[] = [
  { asset: 'Planet-18Uxrb2dIc', azimuthDegrees: 12, elevationDegrees: 4, distanceMeters: 700, diameterMeters: 155 },
  { asset: 'Planet-hKZtOOMadH', azimuthDegrees: 48, elevationDegrees: 9, distanceMeters: 700, diameterMeters: 124 },
  { asset: 'Planet-rYguWNNPvA', azimuthDegrees: 88, elevationDegrees: 3, distanceMeters: 700, diameterMeters: 105 },
  { asset: 'Planet-B7xd3SZq0z', azimuthDegrees: 125, elevationDegrees: 12, distanceMeters: 700, diameterMeters: 134 },
  { asset: 'Planet-EC1Lk2IamI', azimuthDegrees: 160, elevationDegrees: 2, distanceMeters: 700, diameterMeters: 86 },
  { asset: 'Planet-9g1aIbfR9Y', azimuthDegrees: 195, elevationDegrees: 6, distanceMeters: 700, diameterMeters: 133 },
  { asset: 'Planet-4NxxeyYMPJ', azimuthDegrees: 228, elevationDegrees: 14, distanceMeters: 700, diameterMeters: 64 },
  { asset: 'Planet-5zzi8WUMXj', azimuthDegrees: 262, elevationDegrees: 3, distanceMeters: 700, diameterMeters: 97 },
  { asset: 'Planet-IVnmauIgWX', azimuthDegrees: 298, elevationDegrees: 8, distanceMeters: 700, diameterMeters: 112 },
  { asset: 'Planet-pHZz4EMvVM', azimuthDegrees: 330, elevationDegrees: 2, distanceMeters: 700, diameterMeters: 78 },
  { asset: 'Planet', azimuthDegrees: 355, elevationDegrees: 16, distanceMeters: 700, diameterMeters: 83 },
];

export type NoseAxis = '+x' | '-x' | '+z' | '-z';

export interface SpaceFlyingShip {
  readonly asset: string;
  readonly nose: NoseAxis;
  readonly path: 'course' | 'orbit';
  readonly reverse: boolean;
  readonly heightMeters: number;
  readonly speedMetersPerSecond: number;
  readonly startFraction: number;
  readonly scale: number;
  /** Half axes of the orbit ellipse around the course centre; only used by orbit paths. */
  readonly orbitRadii?: { readonly x: number; readonly z: number };
}

export const SPACE_FLYING_SHIPS: readonly SpaceFlyingShip[] = [
  { asset: 'Spaceship', nose: '+z', path: 'course', reverse: false, heightMeters: 15, speedMetersPerSecond: 38, startFraction: 0, scale: 1.5 },
  { asset: 'Spaceship-Jqfed124pQ', nose: '+z', path: 'course', reverse: true, heightMeters: 20, speedMetersPerSecond: 32, startFraction: 0.5, scale: 1.4 },
  {
    asset: 'Spaceship-VSxUAFhzbA',
    nose: '+z',
    path: 'orbit',
    reverse: false,
    heightMeters: 26,
    speedMetersPerSecond: 44,
    startFraction: 0.25,
    scale: 1.6,
    orbitRadii: { x: 300, z: 230 },
  },
  {
    asset: 'Spaceship-u105mYHLHU',
    nose: '+z',
    path: 'orbit',
    reverse: true,
    heightMeters: 70,
    speedMetersPerSecond: 30,
    startFraction: 0.7,
    scale: 2,
    orbitRadii: { x: 240, z: 190 },
  },
];

export const SPACE_STARS = { count: 1600, radiusMeters: 740, sizePixels: 2 } as const;
