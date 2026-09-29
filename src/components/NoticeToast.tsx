// A refused action or a server notice, shown for a few seconds.
import { useEffect } from 'react';
import { ERROR_MESSAGES } from '../copy.ts';
import type { GameStore, Notice } from '../realtime/store.ts';

const SHOWN_MS = 6000;

function messageOf(notice: Notice): string {
  return notice.code === 'server-closing'
    ? 'The server is restarting, so this lobby will close.'
    : ERROR_MESSAGES[notice.code];
}

export function NoticeToast({ notice, store }: { notice: Notice | null; store: GameStore }) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => store.dismissNotice(notice.id), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [notice, store]);
  if (!notice) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-md rounded-lg border border-bad bg-panel p-3 shadow-lg"
    >
      {messageOf(notice)}
    </div>
  );
}
