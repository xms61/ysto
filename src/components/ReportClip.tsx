// "Report this clip" (docs/product-specs/game-flow.md): a fold with four fixed reasons, at the reveal and in
// the song list. Once sent, it says so; the server keeps one report per player and clip.
import { REPORT_REASONS } from '../../shared/protocol.ts';
import type { ReportReason } from '../../shared/protocol.ts';
import type { GameStore } from '../realtime/store.ts';
import { buttonClass } from './ui.tsx';

const REASON_LABELS: Record<ReportReason, string> = {
  silent: 'Silent or too quiet',
  'wrong-song': 'Wrong song',
  'bad-cut': 'Cut badly',
  other: 'Something else',
};

interface ReportClipProps {
  store: GameStore;
  number: number; // the round
  reported: boolean;
}

export function ReportClip({ store, number, reported }: ReportClipProps) {
  if (reported) {
    return (
      <p role="status" className="report-done text-sm text-muted">
        Reported. Thanks.
      </p>
    );
  }
  return (
    <details className="report-clip">
      <summary className="report-summary text-sm">Report this clip</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {REPORT_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            className={buttonClass('quiet')}
            onClick={() => store.reportClip(number, reason)}
          >
            {REASON_LABELS[reason]}
          </button>
        ))}
      </div>
    </details>
  );
}
