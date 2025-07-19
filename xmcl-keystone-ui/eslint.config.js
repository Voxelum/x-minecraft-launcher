// eslint.config.js
import vue from 'eslint-plugin-vue'
import vuetify from 'eslint-plugin-vuetify'
import typescriptEslint from 'typescript-eslint';
import eslint from '@eslint/js';

console.log('hello from xmcl-keystone-ui eslint config')

export default typescriptEslint.config({
  extends: [
    eslint.configs.recommended,
    ...typescriptEslint.configs.recommended,
    ...vue.configs['flat/recommended'],
    ...vuetify.configs['flat/base'],
  ],
  files: ['**/*.{ts,vue}'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      parser: typescriptEslint.parser,
    },
  },
  rules: {
    'vue/multi-word-component-names': 0,
    '@typescript-eslint/no-unused-vars': 0,
    'no-empty': 0,
    '@typescript-eslint/no-unsafe-function-type': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/ban-ts-comment': 0,
    ' vue/no-v-text-v-html-on-component': 0,
  }
})