/** The game vote in order of its cards (`src/party/games.ts` cannot be imported here, it loads the 3D views). */
export const GAME_IDS = ['race', 'timetrial', 'drift', 'tag', 'sumo', 'lavakart', 'soccer', 'memory', 'walk', 'jets'] as const;
export const GAME_COUNT = GAME_IDS.length;
