import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  { ignores: ['dist', 'dist-relay', 'node_modules', 'test-results', 'artifacts', 'public'] },
  {
    files: ['src/**/*.ts', 'server/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { sonarjs },
    rules: {
      'sonarjs/cognitive-complexity': ['error', 9],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['e2e/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    rules: { 'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ['src/shared/ui/**/*.ts', 'src/party/app/**/*.ts'],
    ignores: ['src/shared/ui/components/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TemplateElement[value.raw=/(^|\\s)(class|style)=/]',
          message: 'Views use c-… components and their attributes, no classes or inline styles (src/shared/ui/components/).',
        },
        {
          selector: 'MemberExpression[property.name=/^(style|className|classList)$/]',
          message: 'Views do not style elements; use a component or the hidden attribute.',
        },
        { selector: "AssignmentExpression[left.property.name='innerHTML']", message: 'Render with lit templates instead of innerHTML.' },
      ],
    },
  },
);
