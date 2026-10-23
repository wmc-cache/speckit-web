import type { StageStatus } from '../../../src/core/model.ts';
import { useT, type MessageKey } from '../i18n/index.ts';

export function StageBar({ stage, compact }: { stage: StageStatus; compact?: boolean }) {
  const t = useT();
  return (
    <ol className="stage-bar" data-testid="stage-bar">
      {stage.stages.map((s, index) => {
        const stateKey = s.skipped ? 'skipped' : s.state;
        const label = t(`stage.${s.key}` as MessageKey);
        const stateLabel = t(`stageState.${stateKey}` as MessageKey);
        if (compact && s.key !== stage.current) return null;
        return (
          <li
            key={s.key}
            className={`stage ${s.state}${s.skipped ? ' skipped' : ''}${s.key === stage.current ? ' current' : ''}`}
            title={`${label}: ${stateLabel}`}
            data-stage={s.key}
            data-state={stateKey}
          >
            <span className="stage-number" aria-hidden>
              {s.state === 'done' ? '✓' : String(index + 1).padStart(2, '0')}
            </span>
            <span>{label}</span>
            {!compact && <span className="stage-note">{stateLabel}</span>}
          </li>
        );
      })}
    </ol>
  );
}
