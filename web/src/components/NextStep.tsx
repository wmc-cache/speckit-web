import { useState } from 'react';
import type { FeatureSummary, Project } from '../../../src/core/model.ts';
import { useT, type MessageKey } from '../i18n/index.ts';
import { nextCommand, nextStep } from '../lib/next-step.ts';
import { docHref } from '../router.ts';

export function NextStep({ feature, project }: { feature: FeatureSummary; project: Project }) {
  const t = useT();
  const step = nextStep(feature, !!project.constitution?.filled);
  const command = nextCommand(step);
  const [copied, setCopied] = useState('');
  const [failed, setFailed] = useState(false);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };
  return (
    <section className="next-step" data-testid="next-step">
      <div className="next-heading">
        <span className="next-icon" aria-hidden>
          ↗
        </span>
        <div>
          <span className="eyebrow">{t('guide.next')}</span>
          <h2>{t(`guide.${step}.title` as MessageKey)}</h2>
          <p>{t(`guide.${step}.reason` as MessageKey)}</p>
        </div>
      </div>
      {command && (
        <div className="command-copy">
          <code>{command}</code>
          <button type="button" className="button primary" onClick={() => void copy(command)}>
            {t(copied === command ? 'guide.copied' : 'guide.copy')}
          </button>
        </div>
      )}
      {failed && <p role="alert">{t('guide.copyFailed')}</p>}
      {command && (
        <p className="guide-context">
          {t('guide.where', { agent: project.integration ?? t('guide.agent') })}
        </p>
      )}
      {project.currentFeatureId !== feature.id && (
        <p className="guide-warning">
          {t('guide.context', { id: feature.id, current: project.currentFeatureId ?? t('guide.unknown') })}
        </p>
      )}
      {step === 'plan' && <p className="guide-footnote">{t('guide.optionalClarify')}</p>}
      {step === 'analyze' && (
        <div className="guide-alternative">
          <span>{t('guide.analyzed')}</span>
          <code>/speckit-implement</code>
          <button type="button" className="button" onClick={() => void copy('/speckit-implement')}>
            {t(copied === '/speckit-implement' ? 'guide.copied' : 'guide.copy')}
          </button>
        </div>
      )}
      {step === 'checklistReview' && (
        <ul>
          {feature.checklists
            .filter((c) => c.checked < c.total)
            .map((c) => (
              <li key={c.docId}>
                <a href={docHref(c.docId)}>
                  {c.name} · {c.checked}/{c.total}
                </a>
              </li>
            ))}
        </ul>
      )}
      <p className="guide-footnote">{t('guide.evidence')}</p>
    </section>
  );
}
