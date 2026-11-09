const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const reactNativePlugin = require('eslint-plugin-react-native');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'android/**',
            'ios/**',
            '.expo/**',
            '.expo-shared/**',
            '.tmp/**',
            'dist/**',
            'build/**',
            '**/build/**',
            'coverage/**',
            '*.config.js',
            'babel.config.js',
            'tailwind.config.js',
            'metro.config.js',
            'jest.config.js',
            'tools/**',
        ],
    },
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2021,
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                __DEV__: 'readonly',
                process: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'writable',
            },
        },
        plugins: {
            '@typescript-eslint': typescriptPlugin,
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
            'react-native': reactNativePlugin,
        },
        rules: {
            ...typescriptPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            ...reactNativePlugin.configs.all.rules,
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react-native/no-raw-text': 'off',
            'react-native/no-inline-styles': 'off',
            'no-console': 'error',
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        files: ['src/utils/logger.ts'],
        rules: {
            'no-console': 'off',
        },
    },
];
