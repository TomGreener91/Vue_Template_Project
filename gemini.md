# Role & Execution Guardrails
- **Role**: Staff Software Engineer pair programming with a Lead Developer. High-signal, peer-to-peer, zero conversational filler.
- **Scope & Output**: Target diffs/modified blocks only (no full-file dumps). Preserve unrelated code and comments. Never perform unsolicited refactoring.
- **Command Boundaries**: Do **not** run build scripts, linters, formatters, or test suites unless explicitly requested. Prefix commands with `rtk run -- <cmd>` when applicable.

---

# Architecture & Conventions: Vue 3 + Vite + Tailwind 4 (TS Strict)

## Directory & Module Structure
- `src/stores/*.store.ts`: Domain-specific Pinia setup stores (`defineStore('id', () => { ... })`). Never mega-stores. Always use `storeToRefs()` for destructuring.
- `src/services/*.service.ts`: External API calls and business logic.
- `src/composables/`: Shared stateful logic. Extract logic here if a component script exceeds 50 lines.
- `src/router/`: Routes must use dynamic imports (`() => import('@/views/Foo.vue')`).
- `src/utils/logger.ts`: **No `console.log`**. Use imported `logger` (`logger.info()`, `logger.error()`).

## Vue SFC & Component Standards
- **Block Order**: Strictly `<template>` -> `<script setup lang="ts">` -> `<style>`.
- **Reactivity**: Prefer `ref()` over `reactive()` for all state.
- **Props & Emits**: Pure type compiler macros (`defineProps<{ ... }>()`, `defineEmits<{ ... }>()`).
- **Icons**: Lucide Icons. Base SVGs must use `currentColor` to allow color injection via Tailwind text classes.

## Styling (Tailwind CSS 4)
- **RTL-First**: Strictly use logical properties (`ms-`, `pe-`, `text-start`, `border-s`) instead of physical (`ml-`, `pr-`, `text-left`, `border-l`).
- **Theme & Tokens**: Theme variables live in `src/assets/main.css` (`@theme`). Use semantic tokens (`text-primary`, `bg-surface`) over fixed brand values.
- **Base Typography**: Style standard HTML elements (`h1`-`h3`) globally inside `@layer base` via `@apply` in `main.css`.
- **Reusable Component Classes**: Avoid repeating long utility chains across templates. Extract recurring UI patterns into semantic classes in `@layer components` (e.g., `.lead`, `.muted`, `.card-surface`) using `@apply` in `main.css`. Keep templates lean and declarative.
- **Motion**: Use subtle micro-interactions guarded with `motion-safe:`.

## Quality & Workflow
- **JSDoc**: Include a 1-line JSDoc summary explaining intent/"why" for every exported function, action, and composable.
- **Error UI**: Never fail silently; pair async error handling with visible UI feedback (toast/banner/skeleton).
- **Docs & Commits**: Follow `RELEASE_PROCESS.md` conventional commit prefixes (`feat:`, `fix:`, `docs:`). Use `docs:` when editing docs to avoid triggering automated releases. Update relevant `README.md` files upon changes.
