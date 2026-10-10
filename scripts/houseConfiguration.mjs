import fs from 'node:fs';
import ts from 'typescript';

export async function loadHouseConfiguration() {
  const files = [
    'src/config/items.ts',
    'src/config/driving.ts',
    'src/map/mapConfig.ts',
    'src/map/collision.ts',
    'src/maps/shared/mapSettings.ts',
    'src/maps/familyHouse/settings.ts',
    'src/maps/shared/mapPlacements.ts',
    'src/maps/familyHouse/colliders.ts',
    'src/maps/familyHouse/map.ts',
  ];
  const source = files.map((file) => fs.readFileSync(file, 'utf8').replace(/^import .*\n/gm, '')).join('\n');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).FAMILY_HOUSE;
}
