/** The fixed names a cat can have, as stable ids; the screen shows them in its language. Nobody types a name; every name is taken by one
 *  player at a time. */
export const CAT_NAMES = ['sootpaw', 'mauzi', 'crumbs', 'purry', 'dotty', 'velvetpaw', 'flakey', 'mieze', 'cloudy', 'button'] as const;

export type CatNameId = (typeof CAT_NAMES)[number];

/** Saved cats and older guest phones still carry the German names of before the languages. */
const GERMAN_NAMES: Readonly<Record<string, CatNameId>> = {
  Rußpfote: 'sootpaw',
  Mauzi: 'mauzi',
  Krümel: 'crumbs',
  Schnurri: 'purry',
  Pünktchen: 'dotty',
  Samtpfote: 'velvetpaw',
  Flöckchen: 'flakey',
  Mieze: 'mieze',
  Wölkchen: 'cloudy',
  Knöpfchen: 'button',
};

export function isCatNameId(name: string): name is CatNameId {
  return (CAT_NAMES as readonly string[]).includes(name);
}

/** The id of a stored or received name: an id stays, an old German name becomes its id, anything else stays as it is. */
export function catNameId(name: string): string {
  return GERMAN_NAMES[name] ?? name;
}

export function firstFreeCatName(takenNames: ReadonlySet<string>): CatNameId {
  return CAT_NAMES.find((name) => !takenNames.has(name)) ?? CAT_NAMES[0];
}

/** The next name in `delta` direction that no other player has; stays put when every other name is taken. */
export function nextFreeCatName(current: string, delta: number, takenByOthers: ReadonlySet<string>): string {
  const start = Math.max(CAT_NAMES.indexOf(current as CatNameId), 0);
  for (let step = 1; step <= CAT_NAMES.length; step += 1) {
    const index = (((start + delta * step) % CAT_NAMES.length) + CAT_NAMES.length) % CAT_NAMES.length;
    const candidate = CAT_NAMES[index]!;
    if (!takenByOthers.has(candidate)) return candidate;
  }
  return current;
}
