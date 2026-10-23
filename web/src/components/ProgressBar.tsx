import type { ReactNode } from 'react';
import { useI18n } from '../i18n/index.ts';

export function ProgressBar({ done, total, label }: { done: number; total: number; label?: ReactNode }) {
  const { lang } = useI18n();
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const text = lang === 'zh-CN' ? `${done}/${total}（${pct}%）` : `${done}/${total} (${pct}%)`;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={text}
      aria-label={text}
    >
      {label && <span className="progress-label">{label}</span>}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-text">{text}</span>
    </div>
  );
}
