import { readFileSync, writeFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('custom-elements.json', 'utf8'));

function valueType(attribute) {
  const text = attribute.type?.text ?? 'string';
  if (text === 'boolean') return { type: 'boolean' };
  if (text === 'number') return { type: 'number' };
  const options = [...text.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  return options.length > 0 ? { type: options.map((option) => `"${option}"`).join(' | ') } : { type: 'string' };
}

const elements = manifest.modules.flatMap((module) =>
  (module.declarations ?? [])
    .filter((declaration) => declaration.customElement && declaration.tagName)
    .map((declaration) => ({
      name: declaration.tagName,
      description: declaration.description ?? '',
      source: { module: `./${module.path}`, symbol: declaration.name },
      attributes: (declaration.attributes ?? []).map((attribute) => ({
        name: attribute.name,
        description: attribute.description ?? '',
        value: valueType(attribute),
      })),
    })),
);

const webTypes = {
  $schema: 'https://json.schemastore.org/web-types',
  name: 'cat-kart-components',
  version: '0.0.0',
  'js-types-syntax': 'typescript',
  'description-markup': 'markdown',
  contributions: { html: { elements } },
};

writeFileSync('web-types.json', `${JSON.stringify(webTypes, null, 2)}\n`);
console.log(`web-types.json: ${elements.length} elements`);
