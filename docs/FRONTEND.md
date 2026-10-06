---
status: verified
last-verified: 2026-10-05
---

# Frontend

How the UI code is built. How it should look is in [DESIGN.md](DESIGN.md), and what players can do is in the [product specs](product-specs/index.md).

## Stack
- React 19 and TypeScript 6.0, bundled by Vite 8 (`vite.config.ts`).
- Tailwind CSS 4 through `@tailwindcss/vite`. It is configured in CSS (`src/styles.css`), with no config file.
- `uqr` draws the join link's QR code. It is the only runtime library besides React.
- The themes' display fonts come from Fontsource packages (`@fontsource/zen-kaku-gothic-new`, `zen-antique`, `bangers`, `saira-stencil-one`, `mochiy-pop-one`, `press-start-2p` and `vt323`, plus `pixelify-sans` for Isekai's card titles, Latin subsets only), which Vite copies into `dist/` so they're served from our own origin. A page loads only the fonts it shows. Japanese titles use the device's Japanese fonts (`--ja-font`), never a display face's fallback.
- The client libraries are devDependencies: Vite bundles them into `dist/`, and the production image installs only what the server needs at runtime.

## Structure
`index.html` loads `src/main.tsx`, which mounts `App` with the browser's audio engine and storage.
- `App.tsx`: the home screen until the tab holds a seat, then `LobbySession`. It keeps the seat, the device settings, and the address bar (`/j/<code>` while in a lobby).
- `screens/`: `Home` (create or join), `LobbySession` (one store and socket per seat; picks the screen), `Lobby` (invite, players, settings, start), `Round` (countdown, options, timer), `Reveal` and `Results`.
- `components/`: the option cards and the face-down deal (`OptionCard.tsx`), the burst of a theme's material at the reveal and the results (`Burst.tsx`), the round's layout that keeps the cards in one place (`Stage.tsx`), the listening panel (`Listening.tsx`), the settings form and its summary, the player list, the QR code, the device settings with the theme picker and the Preferences menu (`PrefsPanel.tsx`), the theme's backdrop (`Backdrop.tsx`), the sound banner, the notice toast, and the shared buttons and panels in `ui.tsx`.
- `realtime/`: the lobby routes (`api.ts`), the socket with hello, pings and reconnects (`connection.ts`), the server clock (`clock.ts`), the pure reducer of server messages (`game-state.ts`), and `store.ts`, which ties them to the audio engine and gives the screens one snapshot.
- `audio/engine.ts`: fetches, decodes and plays each clip through Web Audio ([audio clips](design-docs/audio-clips.md)).
- `history/history.ts`: the device's game log in `localStorage` (`ysto_history`): each finished game with its songs, and `animeLog`, which counts every anime heard ([game log](product-specs/game-log.md)).
- `settings/saved.ts`: the host's saved setups in `localStorage` (`ysto_saved_settings`), and `fitSetup`, which fits one to a lobby's bounds.
- `prefs/prefs.ts`: volume, theme, title languages (a first and an optional second) and motion, in `localStorage`. `usePrefs` puts `data-theme`, `data-motion` and the browser's theme color on `<html>` before the first paint.
- `styles.css`: Tailwind, the seven themes as blocks of variables, the component classes (`.display`, `.panel`, `.card` and its faces, `.listening`, `.page-texture`), each theme's card stock and frames, and the animations ([DESIGN.md](DESIGN.md)). `realtime/session.ts` keeps the seat in `sessionStorage`, `whats-new.ts` holds the players' notes per version and the last version this device saw (`ysto_seen_version`, in `localStorage`), and `version.ts` notes in `sessionStorage` which server version it reloaded for (`ysto_reloaded_for`): the page's version comes from `package.json` through Vite's `define`. Both go through `storage.ts`, which survives blocked storage.
- `copy.ts` words every error code. `format.ts` formats places, points, times, titles and credits.
- `testing/fakes.ts`: a fake socket, a fake `AudioContext`, and builders for server messages. Only tests import it.

## Rules
- `src/` never imports `server/` or Node built-ins, and never reads `process.env`. Shared code goes through `shared/`. ESLint enforces all three ([ARCHITECTURE.md](../ARCHITECTURE.md)).
- Relative imports name the real file, extension included (`./App.tsx`), as on the server.
- Hooks follow the recommended rules of `eslint-plugin-react-hooks`, including the compiler rules: no `setState` straight inside an effect, and no impure calls such as `Date.now()` during render. Time reaches components through `useTicker` and `useReached` (`hooks.ts`).
- Server messages change state only through `receive` in `game-state.ts`. Side effects of a message (loading a clip, playing, stopping, `round:ready`) live in `GameStore`, and screens call the store's actions.
- Every time from the server is a server time. Convert it with the store's clock (`serverNow`, and `toLocal` for the audio engine), never with `Date.now()` alone.
- The options show at `startsAt` and not before (`useReached`), even though `round:start` brings them about a second early.
- Nothing sends settings the server would refuse: the store checks them with `validateSettings` first, because every refusal counts against the socket.
- Storage keys (`ysto_prefs`, `ysto_session`) are permanent once released.
- Colors, radii, type and shadows come from the theme tokens, never from raw values in a component, so every theme applies to every screen.
- An animation runs only through a `motion-*` class or a theme decoration that `styles.css` starts under `:root[data-motion='full']`. Motion that script drives (the results' count, Tokyo Rain's flapping title, the lock-in buzz) checks `motionAllowed()` from `hooks.ts` first.
- The options lie face down until the clip starts, then all four turn face up together in the same frame, on a curve that shows their titles within about a frame (the Equal Four Rule in [DESIGN.md](DESIGN.md)).
- Each screen of a game tells the page its phase with `usePagePhase` (`data-phase` on `<html>`: lobby, countdown, playing, reveal, results), and the backdrop's weather follows it in CSS. The phase comes from the game's state, never from the audio.
- The four option cards are always equal: one `OptionCard` per option, the same stock and index mark, and a state (`open`, `chosen`, `muted`, `missed`, `right`) that never singles one out before the reveal.
- A theme's stock hangs off `:root[data-theme='<id>']` selectors, so it applies to the page's own theme. The theme picker's previews use only variables, which is why they can show another theme inside the page.
- The CSP allows no inline `<style>` and no `style` attributes in HTML. React's `style` prop sets styles through the CSSOM, which the CSP allows; keep it to values that change at runtime, such as the progress bar's width.

## Checks
- `npm run test:web` runs the client tests: the reducer, the clock, the socket, the store and the audio engine against fakes, whole flows through `App` with Testing Library, and the themes' contrast (`themes.test.ts`, which reads `styles.css`) ([TESTING.md](TESTING.md)).
- `npm run build && npm run test:e2e` loads the built app, decodes a clip in each browser, plays a whole game with two players against the fixture server, and runs axe on every screen in every theme.
