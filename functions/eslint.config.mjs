import js from '@eslint/js'
import globals from 'globals'
export default [{ files: ['**/*.mjs'], ...js.configs.recommended, languageOptions: { globals: globals.node } }]
