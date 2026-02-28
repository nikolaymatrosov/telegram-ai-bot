// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jestPlugin from 'eslint-plugin-jest';

export default tseslint.config(
  // Ignore compiled output and non-project files
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // Base JS recommended rules
  eslint.configs.recommended,

  // TypeScript type-checked rules for src/
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts'],
  })),

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // TypeScript type-checked rules for tests/ — uses tsconfig.test.json
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['tests/**/*.ts'],
  })),

  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Allow underscore-prefixed unused variables/args across all TS files
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Jest plugin scoped to test files + relax type-safety rules for mock patterns
  {
    files: ['tests/**/*.ts'],
    plugins: {
      jest: jestPlugin,
    },
    rules: {
      ...jestPlugin.configs['flat/recommended'].rules,
      // Jest mock setups legitimately use `any` for partial mocks
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },

  // Disable type-checked rules for .js config files
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
