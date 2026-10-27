// Tailwind at-rules. Restated in `rules` because stylelint-config-recommended-vue has to come last
// in `extends` and replaces stylelint-config-tailwindcss's list, so .vue <style> blocks lose it.
const TAILWIND_AT_RULES = [
  'apply',
  'config',
  'custom-variant',
  'layer',
  'plugin',
  'reference',
  'source',
  'tailwind',
  'theme',
  'utility',
  'variant',
];

export default {
  extends: [
    // Base CSS catching “real” problems
    'stylelint-config-standard',
    // Tailwind-aware adjustments (prevents false positives on @tailwind, @apply, etc.)
    'stylelint-config-tailwindcss',
    // Vue SFC parsing + Vue-specific tuning (MUST be last so its customSyntax is applied)
    'stylelint-config-recommended-vue',
  ],
  plugins: ['stylelint-order'],
  overrides: [
    {
      files: ['**/*.vue', '**/*.html'],
      customSyntax: 'postcss-html', // parse <style> blocks in .vue
    },
  ],
  rules: {
    // add any team preferences here
    'block-no-empty': null,
    'no-empty-source': null,

    // Tailwind support. @apply in @layer components is the preferred way to share utility
    // chains, so none of its syntax may be flagged, in .css or in .vue <style> blocks.
    'at-rule-no-unknown': [true, { ignoreAtRules: TAILWIND_AT_RULES }],
    'function-no-unknown': [true, { ignoreFunctions: ['theme', 'v-bind'] }],
    // An @apply utility list isn't CSS, so its prelude can't be validated.
    'at-rule-prelude-no-invalid': [true, { ignoreAtRules: ['apply'] }],
    // Tailwind's CSS functions (theme(), --spacing(), --alpha()) aren't known CSS values.
    'declaration-property-value-no-unknown': [
      true,
      { ignoreProperties: { '/.+/': '/(^|[\\s(,])(theme|--[\\w-]+)\\(/' } },
    ],
    // Let the Tailwind header (@import, @plugin, @source, @reference…) sit without blank lines.
    'at-rule-empty-line-before': [
      'always',
      { except: ['first-nested'], ignore: ['after-comment', 'blockless-after-blockless'] },
    ],
  },
  ignoreFiles: ['**/dist/**/*', 'node_modules/**/*'],
};
