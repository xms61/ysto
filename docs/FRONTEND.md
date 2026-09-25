---
status: draft
last-verified: 2026-09-25
---

# Frontend

How the UI code is built. How it should look is in [DESIGN.md](DESIGN.md).

## Stack
- React 19 and TypeScript 6.0, bundled by Vite 8 (`vite.config.ts`).
- Tailwind CSS 4 through `@tailwindcss/vite`. It is configured in CSS (`src/styles.css`), with no config file.
- The client libraries are devDependencies: Vite bundles them into `dist/`, and the production image installs only what the server needs at runtime.

## Structure
- `index.html` loads `src/main.tsx`, which mounts `App` into `#root`.
- `src/App.tsx` is the only screen so far: the title.
- `src/styles.css` holds Tailwind and the base colors, which the three themes replace in M7.
- Tests sit next to the code they cover (`src/App.test.tsx`).

## Rules
- `src/` never imports `server/` or Node built-ins, and never reads `process.env`. Shared code goes through `shared/`. ESLint enforces all three ([ARCHITECTURE.md](../ARCHITECTURE.md)).
- Relative imports name the real file, extension included (`./App.tsx`), as on the server.
- Hooks follow the recommended rules of `eslint-plugin-react-hooks`.

## Checks
- `npm run test:web` runs the component tests with Testing Library ([TESTING.md](TESTING.md)).
- `npm run build && npm run test:e2e` loads the built app at `/` and at a join link, in Chromium and WebKit.
