'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'coverage/', 'version-anterior/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      // catch vacíos son intencionales (localStorage/notificaciones pueden fallar)
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      // umbral de complejidad ciclomática del estándar (ítem B2); warn para listar las que lo superan sin romper el CI
      complexity: ['warn', 10]
    }
  }
];
