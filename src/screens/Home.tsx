// The start screen: create a lobby, or join one with a code or a join link, and a name
// (docs/product-specs/lobby.md).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { cleanName, NAME_MAX_LENGTH } from '../../shared/names.ts';
import { CODE_LENGTH, normalizeCode } from '../../shared/protocol.ts';
import { PreferencesMenu } from '../components/PrefsPanel.tsx';
import { Button, INPUT, Panel } from '../components/ui.tsx';
import { ERROR_MESSAGES } from '../copy.ts';
import type { Prefs } from '../prefs/prefs.ts';
import { createLobby, joinLobby } from '../realtime/api.ts';
import type { Seated } from '../realtime/api.ts';
import type { Session } from '../realtime/session.ts';

interface HomeProps {
  joinCode: string | null; // from a join link
  notice: string | null; // why the player is back here
  prefs: Prefs;
  onPrefs: (change: Partial<Prefs>) => void;
  unlockAudio: () => void;
  onSeated: (session: Session) => void;
  onShowLog: () => void;
}

const CODE_MESSAGE = `Lobby codes have ${CODE_LENGTH} letters and digits.`;

// The whole game in three lines, for a friend who has never played (docs/product-specs/game-flow.md).
function HowToPlay() {
  return (
    <details className="panel how-to-play px-4 py-3">
      <summary className="adjust-summary">How to play</summary>
      <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-muted">
        <li>Everyone in the lobby hears the same few seconds of an opening or ending, at the same moment.</li>
        <li>Pick the anime from four options, by tap or with keys 1 to 4. The host picks how answers score.</li>
        <li>After each round you see the answer and the scores. You can play alone too.</li>
      </ol>
    </details>
  );
}

export function Home({ joinCode, notice, prefs, onPrefs, unlockAudio, onSeated, onShowLog }: HomeProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(joinCode ?? '');
  const [linked, setLinked] = useState(joinCode !== null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Audio may only start from a player's own tap, so this one unlocks it for the rounds to come.
  async function seat(event: FormEvent, request: (cleaned: string) => Promise<Seated> | string) {
    event.preventDefault();
    unlockAudio();
    const cleaned = cleanName(name);
    if (cleaned === null) return setError(ERROR_MESSAGES['invalid-name']);
    const pending = request(cleaned);
    if (typeof pending === 'string') return setError(pending);
    setBusy(true);
    const result = await pending;
    setBusy(false);
    if ('error' in result) return setError(ERROR_MESSAGES[result.error]);
    onSeated(result.session);
  }

  const create = (event: FormEvent) => seat(event, (cleaned) => createLobby(cleaned));
  const join = (event: FormEvent) =>
    seat(event, (cleaned) => {
      const normalized = normalizeCode(code);
      return normalized === null ? CODE_MESSAGE : joinLobby(normalized, cleaned);
    });

  const nameField = (
    <label className="flex flex-col gap-1.5 font-medium">
      Your name
      <input
        className={INPUT}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="nickname"
        maxLength={NAME_MAX_LENGTH * 2}
        required
      />
    </label>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-4">
      <div className="relative flex">
        <PreferencesMenu prefs={prefs} onChange={onPrefs} />
      </div>
      <header className="text-center">
        <h1 className="display text-5xl sm:text-6xl">
          You Skipped The OP<span className="title-bang">?!</span>
        </h1>
        <p className="mt-3 text-muted">Hear a few seconds of an opening or ending, then pick the anime.</p>
      </header>
      {notice && (
        <p role="status" className="rounded-lg border border-line bg-raised p-3">
          {notice}
        </p>
      )}
      {linked ? (
        <Panel>
          <form className="flex flex-col gap-4" onSubmit={join}>
            {nameField}
            <Button type="submit" disabled={busy}>
              Join lobby {normalizeCode(code) ?? code}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 text-sm text-muted underline"
            onClick={() => {
              setLinked(false);
              setCode('');
            }}
          >
            Create a new lobby instead
          </button>
        </Panel>
      ) : (
        <Panel>
          <form className="flex flex-col gap-4" onSubmit={create}>
            {nameField}
            <Button type="submit" disabled={busy}>
              Create a lobby
            </Button>
          </form>
          <p className="my-5 text-center text-sm text-muted">or join a friend&apos;s lobby</p>
          <form className="flex gap-2" onSubmit={join}>
            <label className="flex flex-1 flex-col gap-1.5 font-medium">
              Lobby code
              <input
                className={`${INPUT} font-mono uppercase tracking-widest`}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={CODE_LENGTH}
              />
            </label>
            <Button type="submit" variant="quiet" className="self-end" disabled={busy}>
              Join
            </Button>
          </form>
        </Panel>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-bad p-3 text-bad">
          {error}
        </p>
      )}
      <HowToPlay />
      <Button variant="quiet" className="self-center" onClick={onShowLog}>
        Your games
      </Button>
      <footer className="mt-auto text-center text-sm text-muted">Song data from AnimeThemes and AniList.</footer>
    </main>
  );
}
