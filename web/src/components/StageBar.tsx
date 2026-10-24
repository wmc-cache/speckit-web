import type { StageStatus } from '../../../src/core/model.ts';
import { useT, type MessageKey } from '../i18n/index.ts';

export function StageBar({
  stage,
  compact,
  openClarifications = 0,
}: {
  stage: StageStatus;
  compact?: boolean;
  openClarifications?: number;
}) {
  const t = useT();
  return (
    <ol className="stage-bar" data-testid="stage-bar">
      {stage.stages.map((s, index) => {
        const attention = s.key === 'clarify' && openClarifications > 0;
        const stateKey = attention ? 'needs_attention' : s.skipped ? 'skipped' : s.state;
        const label = t(`stage.${s.key}` as MessageKey);
        const stateLabel = attention
          ? t('feature.clarifyOpen', { n: openClarifications })
          : t(`stageState.${stateKey}` as MessageKey);
        if (compact && s.key !== stage.current) return null;
        return (
          <li
            key={s.key}
            className={`stage ${attention ? 'needs_attention' : s.state}${s.skipped && !attention ? ' skipped' : ''}${s.key === stage.current ? ' current' : ''}`}
            title={`${label}: ${stateLabel}`}
            data-stage={s.key}
            data-state={stateKey}
          >
            <span className="stage-number" aria-hidden>
              {attention ? '!' : s.state === 'done' ? '✓' : String(index + 1).padStart(2, '0')}
            </span>
            <span>{label}</span>
            {!compact && <span className="stage-note">{stateLabel}</span>}
          </li>
        );
      })}
    </ol>
  );
}
