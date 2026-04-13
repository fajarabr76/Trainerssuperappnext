import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'import/no-anonymous-default-export': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: [
      'reference-old-app/**',
      'testsprite_tests/**',
      'tmp/**',
      'public/**',
      'trainers-superapp/**',
      '.agent/**',
      '.codex-plugin/**',
      '**/.next/**',
    ],
  },
];

export default config;
