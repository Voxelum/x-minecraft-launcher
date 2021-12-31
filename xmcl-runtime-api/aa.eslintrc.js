/**
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  env: {
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended',
    'standard',
  ],
  plugins: [
    '@typescript-eslint',
  ],
  overrides: [
    {
      files: [
        '*.spec.ts',
      ],
      globals: {
        describe: true,
        expect: true,
        test: true,
        jest: true,
        beforeEach: true,
      },
    },
    {
      files: ['*.ts'], // Your TypeScript files extension
      parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 2020,
        sourceType: 'module',
        tsconfigRootDir: '.',
        project: ['**/tsconfig.json'], // Specify it only for TypeScript files
      },
    },
  ],
}
