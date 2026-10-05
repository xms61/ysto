// The app: the home screen until this tab holds a seat, then that lobby. The seat survives a reload, and a
// join link (/j/<code>) opens the home screen ready to join.
import { useEffect, useState } from 'react';
import { normalizeCode } from '../shared/protocol.ts';
import type { AudioEngine } from './audio/engine.ts';
import { Backdrop } from './components/Backdrop.tsx';
import { Button } from './components/ui.tsx';
import { usePrefs } from './prefs/prefs.ts';
import type { ExitReason, SocketLike } from './realtime/connection.ts';
import { readSession, writeSession } from './realtime/session.ts';
import type { Session } from './realtime/session.ts';
import { Home } from './screens/Home.tsx';
import { LobbySession } from './screens/LobbySession.tsx';
import { ThemeContext } from './themes/stage.ts';
import { WhatsNew } from './components/WhatsNew.tsx';
import { CLIENT_VERSION } from './version.ts';
import { markSeen, notesToShow } from './whats-new.ts';

export interface AppStorage {
  local: Storage | null; // device settings
  session: Storage | null; // this tab's seat
}

export interface AppProps {
  audio: AudioEngine;
  storage: AppStorage;
  createSocket?: (url: string) => SocketLike;
  reload?: () => void; // reloads the page when the server runs another version
}

const EXIT_NOTICES: Record<Exclude<ExitReason, 'left' | 'replaced'>, string> = {
  kicked: 'The host removed you from the lobby.',
  'lobby-closed': 'The lobby closed.',
  'unknown-session': 'That lobby has closed, or your seat was given up. Create a new lobby or join another.',
};

const JOIN_PATH = /^\/j\/([^/]+)\/?$/;

function codeFromPath(pathname: string): string | null {
  const match = JOIN_PATH.exec(pathname);
  return match?.[1] ? normalizeCode(match[1]) : null;
}

export function App({ audio, storage, createSocket, reload }: AppProps) {
  const { prefs, update: updatePrefs, reducedMotion } = usePrefs(storage.local);
  const [session, setSession] = useState(() => readSession(storage.session));
  const [joinCode, setJoinCode] = useState(() => codeFromPath(window.location.pathname));
  const [notice, setNotice] = useState<string | null>(null);
  const [replaced, setReplaced] = useState(false);
  const [notes, setNotes] = useState(() => notesToShow(storage.local, CLIENT_VERSION));
  const notesSeen = () => {
    markSeen(storage.local, CLIENT_VERSION);
    setNotes([]);
  };

  useEffect(() => {
    audio.setVolume(prefs.volume / 100);
  }, [audio, prefs.volume]);
  // The address bar shows the lobby's join link while this tab is in it, so it can be shared from there.
  useEffect(() => {
    const path = session ? `/j/${session.code}` : '/';
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);
  }, [session]);

  function seated(next: Session) {
    writeSession(storage.session, next);
    setNotice(null);
    setSession(next);
  }

  function exited(reason: ExitReason) {
    if (reason === 'replaced') return setReplaced(true);
    writeSession(storage.session, null);
    setSession(null);
    setJoinCode(null);
    setNotice(reason === 'left' ? null : EXIT_NOTICES[reason]);
  }

  function screen() {
    if (!session) {
      return (
        <>
          <Home
            joinCode={joinCode}
            notice={notice}
            prefs={prefs}
            onPrefs={updatePrefs}
            unlockAudio={() => audio.unlock()}
            onSeated={seated}
          />
          {notes.length > 0 && <WhatsNew lines={notes} onClose={notesSeen} />}
        </>
      );
    }
    if (replaced) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
          <h1 className="display text-2xl">This lobby is open somewhere else</h1>
          <p className="text-muted">Your seat moved to another tab or device. You can take it back here.</p>
          <Button
            onClick={() => {
              audio.unlock();
              setReplaced(false);
            }}
          >
            Play here
          </Button>
        </main>
      );
    }
    return (
      <LobbySession
        key={session.sessionToken}
        session={session}
        audio={audio}
        prefs={prefs}
        onPrefs={updatePrefs}
        onExit={exited}
        createSocket={createSocket}
        storage={storage.session}
        reload={reload}
        notes={notes}
        onNotesSeen={notesSeen}
      />
    );
  }

  return (
    <ThemeContext value={prefs.theme}>
      <Backdrop theme={prefs.theme} reducedMotion={reducedMotion} />
      {screen()}
    </ThemeContext>
  );
}
