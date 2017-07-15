// http://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module'
  },
  env: {
    browser: true,
  },
  extends: 'airbnb-base',
  // required to lint *.vue files
  plugins: [
    'html'
  ],
  // check if imports actually resolve
  'settings': {
    'import/resolver': {
      'webpack': {
        'config': '.electron-vue/webpack.main.config.js'
      }
    }
  },
  // add your custom rules here
  'rules': {
    // don't require .vue extension when importing
    'import/extensions': ['error', 'always', {
      'js': 'never',
      'vue': 'never'
    }],
    // allow optionalDependencies
    'import/no-extraneous-dependencies': ['error', {
      'optionalDependencies': ['test/unit/index.js']
    }],
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    "indent": ["error", 4],
    "space-before-function-paren": ["warn", "never"],
    "no-console": 0,
    "no-alert": 0,
    "func-names": 0,
    "no-underscore-dangle": 0,
    "semi": 0,
    "no-restricted-syntax": 0,
    "no-prototype-builtins": 0,
    "no-param-reassign": 0,
    "global-require": 0,
    "no-trailing-spaces": 0,
    "no-unused-vars": 0,
    "wrap-iife": 0
  }
}
