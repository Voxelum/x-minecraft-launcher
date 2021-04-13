/**
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  env: {
    "browser": true,
    "commonjs": true,
    "es2021": true,
    "node": true
  },
  extends: [
    'plugin:vue/recommended',
    "plugin:@typescript-eslint/recommended",
    'standard'
  ],
  parser: "vue-eslint-parser",
  parserOptions: {
    "parser": "@typescript-eslint/parser",
    "ecmaVersion": 2020,
    "project": "tsconfig.json",
    "sourceType": "module",
    "tsconfigRootDir": ".",
    "extraFileExtensions": [
      ".vue"
    ]
  },
  plugins: [
    "vue",
    "@typescript-eslint"
  ],
  "globals": {
    NodeJS: true
  },
  "settings": {
  },
  "overrides": [
    // {
    //   "files": [
    //     "src/**/*.vue"
    //   ]
    // },
    {
      "files": [
        "*.spec.ts"
      ],
      "globals": {
        "describe": true,
        "expect": true,
        "test": true,
        "jest": true,
        "beforeEach": true
      }
    }
  ],
  "rules": {
    // "import/no-extraneous-dependencies": [
    //     "error",
    //     {}
    // ],

    "indent": "off",
    "@typescript-eslint/indent": ["error", 2, { "SwitchCase": 1, ignoredNodes: ['TSTypeParameterInstantiation'] }],
    "comma-dangle": "off",
    "@typescript-eslint/comma-dangle": ["error", "always-multiline"],
    "semi": "off",
    "@typescript-eslint/semi": ["error", "never"],
    "no-redeclare": "off",
    "standard/no-callback-literal": "off",
    "@typescript-eslint/no-redeclare": ["error"],
    "@typescript-eslint/member-delimiter-style": ["error", { multiline: { delimiter: 'none' } }],
    "@typescript-eslint/ban-types": 0,
    "@typescript-eslint/ban-ts-comment": 0,
    "@typescript-eslint/explicit-function-return-type": 0,
    "@typescript-eslint/explicit-module-boundary-types": 0,
    "@typescript-eslint/no-empty-function": 0,
    "@typescript-eslint/no-empty-interface": 0,
    "@typescript-eslint/no-explicit-any": 0,
    "@typescript-eslint/no-non-null-assertion": 0,
    "@typescript-eslint/no-unused-expressions": 2,
    "@typescript-eslint/no-unused-vars": 0,
    "import/no-absolute-path": 0,
    "space-before-function-paren": 0,
    "no-useless-constructor": 0,
    // "arrow-parens": 0,
    // "class-methods-use-this": 0,
    // "func-names": 0,
    // "global-require": 0,
    // "import/extensions": 0,
    // "import/no-named-as-default": 0,
    // "import/prefer-default-export": 0,
    // "max-classes-per-file": 0,
    // "max-len": 0,
    // "no-alert": 1,
    // "no-array-constructor": 0,
    // "no-await-in-loop": 0,
    // "no-console": 0,
    // "no-continue": 0,
    // "no-debugger": 0,
    // "no-mixed-operators": 0,
    // "no-nested-ternary": 0,
    // "no-param-reassign": 0,
    // "no-plusplus": 0,
    // "no-prototype-builtins": 0,
    // "no-restricted-syntax": 0,
    // "no-shadow": 0,
    // "no-throw-literal": "off",
    // "no-trailing-spaces": 0,
    // "no-underscore-dangle": 0,
    // "no-unused-expressions": "off",
    "no-unused-vars": 0,
    "no-use-before-define": 0,
    // "no-useless-constructor": 0,
    // "object-curly-new-line": 0,
    // "object-curly-newline": 0,
    // "prefer-const": 0,
    // "prefer-destructuring": 0,
    // "space-before-function-paren": 0,
    // "vue/html-closing-bracket-newline": 0,
    // "vue/html-self-closing": 0,
    // "vue/max-attributes-per-line": 0,
    // "vue/no-v-html": 0,
    // "vue/singleline-html-element-content-newline": 0,
    // "vue/valid-v-if": "error",
    // "wrap-iife": 0
  }
}