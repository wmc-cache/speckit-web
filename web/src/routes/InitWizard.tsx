import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  InitPlan,
  IntegrationInfo,
  NumberingKind,
  ScriptKind,
  TargetState,
} from '../../../src/core/model.ts';
import { Dialog } from '../components/Dialog.tsx';
import { Dropdown } from '../components/Dropdown.tsx';
import { useData } from '../data/context.ts';
import { ApiRequestError, LocalSource } from '../data/local.ts';
import { useT, type MessageKey } from '../i18n/index.ts';
import { navigate } from '../router.ts';

interface InitOptionsResponse {
  runner: { kind: 'specify' | 'uvx'; version: string | null } | null;
  prerequisites: { name: string; ok: boolean; installHint: string }[];
  integrations: IntegrationInfo[];
  defaults: { integration: string; script: ScriptKind; featureNumbering: NumberingKind };
  targetState: TargetState;
}

type Step = 'options' | 'preview' | 'done';
const OTHER = '__other__';

function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function InitWizard() {
  const t = useT();
  const { source, reloadProject } = useData();
  const api = source as LocalSource;
  const [info, setInfo] = useState<InitOptionsResponse | null>(null);
  const [step, setStep] = useState<Step>('options');
  const [targetKind, setTargetKind] = useState<'here' | 'new'>('here');
  const [name, setName] = useState('');
  const [integration, setIntegration] = useState('claude');
  const [otherKey, setOtherKey] = useState('');
  const [script, setScript] = useState<ScriptKind>('sh');
  const [numbering, setNumbering] = useState<NumberingKind>('sequential');
  const [plan, setPlan] = useState<InitPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [leftovers, setLeftovers] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ projectRoot: string } | null>(null);

  const load = useCallback(() => {
    fetch('api/init/options')
      .then((r) => r.json() as Promise<InitOptionsResponse>)
      .then((j) => {
        setInfo(j);
        setIntegration(j.defaults.integration);
        setScript(j.defaults.script);
        setNumbering(j.defaults.featureNumbering);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);
  useEffect(load, [load]);

  const integrationOptions = useMemo(
    () => [
      ...(info?.integrations ?? []).map((i) => ({ value: i.key, label: i.name, hint: i.key })),
      { value: OTHER, label: t('init.other') },
    ],
    [info, t],
  );

  if (!info) return <p className="muted">{error ? t('error.generic', { msg: error }) : t('doc.loading')}</p>;

  const steps: [Step | 'prereq', MessageKey][] = [
    ['prereq', 'init.step.prereq'],
    ['options', 'init.step.options'],
    ['preview', 'init.step.preview'],
    ['done', 'init.step.done'],
  ];
  const activeStep = info.runner ? step : 'prereq';
  const header = (
    <>
      <h1 className="page-title">{t('init.title')}</h1>
      <ol className="wizard-steps">
        {steps.map(([key, label]) => (
          <li key={key} className={activeStep === key ? 'active' : ''}>
            {t(label)}
          </li>
        ))}
      </ol>
    </>
  );

  if (!info.runner)
    return (
      <section data-testid="init-wizard">
        {header}
        <div className="notice warn">{t('init.prereqMissing')}</div>
        {info.prerequisites.map((p) => (
          <pre key={p.name} className="command">
            {p.installHint}
          </pre>
        ))}
        <button type="button" className="button" onClick={load}>
          {t('init.recheck')}
        </button>
      </section>
    );

  const generate = async () => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const p = await api.post<InitPlan>('api/init/plan', {
        target: targetKind === 'here' ? { kind: 'here' } : { kind: 'new', name },
        integration: integration === OTHER ? otherKey : integration,
        script,
        featureNumbering: numbering,
      });
      setPlan(p);
      setStep('preview');
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'INVALID_OPTIONS')
        setFieldErrors((e.body.fields ?? {}) as Record<string, string>);
      else if (e instanceof ApiRequestError)
        setError(`${t('init.failed')}${e.body.log ? `\n${String(e.body.log)}` : ''}`);
      else setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan) return;
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ projectRoot: string }>('api/init/apply', {
        planId: plan.planId,
        confirmOverwrite: true,
      });
      setResult(r);
      setStep('done');
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'PLAN_EXPIRED') setError(t('init.expired'));
      else if (e instanceof ApiRequestError) {
        setLeftovers((e.body.leftovers as string[] | undefined) ?? []);
        setError(t('init.failed'));
      } else setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const back = async () => {
    if (plan) await api.post('api/init/cancel', { planId: plan.planId }).catch(() => {});
    setPlan(null);
    setStep('options');
  };

  return (
    <section data-testid="init-wizard">
      {header}
      {error && (
        <div className="notice error" role="alert">
          <pre className="error-text">{error}</pre>
          {leftovers.length > 0 && (
            <>
              <p>{t('init.leftovers')}</p>
              <ul>
                {leftovers.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {step === 'options' && (
        <div className="card">
          <p className="muted">
            {t('init.prereqOk', {
              runner:
                info.runner.kind === 'uvx'
                  ? 'uvx specify'
                  : t('init.runnerVersion', { version: info.runner.version ?? '?' }),
            })}
          </p>
          <div className="form-row">
            <span className="label">{t('init.target')}</span>
            <div>
              <Segmented
                label={t('init.target')}
                value={targetKind}
                onChange={setTargetKind}
                options={[
                  { value: 'here', label: t('init.targetHere') },
                  { value: 'new', label: t('init.targetNew') },
                ]}
              />{' '}
              {targetKind === 'here' && (
                <span className="muted">{t(`init.target.state.${info.targetState}` as MessageKey)}</span>
              )}
            </div>
            {fieldErrors.target && <span className="field-error">{t(fieldErrors.target as MessageKey)}</span>}
          </div>
          {targetKind === 'new' && (
            <div className="form-row">
              <label className="label" htmlFor="init-name">
                {t('init.name')}
              </label>
              <input
                id="init-name"
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div className="form-row">
            <span className="label">{t('init.integration')}</span>
            <Dropdown
              ariaLabel={t('init.integration')}
              options={integrationOptions}
              value={integration}
              onChange={setIntegration}
              searchable
              className="align-left"
              testId="integration-dropdown"
            />
            {fieldErrors.integration && (
              <span className="field-error">{t(fieldErrors.integration as MessageKey)}</span>
            )}
          </div>
          {integration === OTHER && (
            <div className="form-row">
              <label className="label" htmlFor="init-other">
                {t('init.otherKey')}
              </label>
              <input
                id="init-other"
                className="text-input"
                value={otherKey}
                onChange={(e) => setOtherKey(e.target.value)}
              />
            </div>
          )}
          <div className="form-row">
            <span className="label">{t('init.script')}</span>
            <Segmented
              label={t('init.script')}
              value={script}
              onChange={setScript}
              options={[
                { value: 'sh', label: 'sh' },
                { value: 'ps', label: 'PowerShell' },
                { value: 'py', label: 'Python' },
              ]}
            />
          </div>
          <div className="form-row">
            <span className="label">{t('init.numbering')}</span>
            <Segmented
              label={t('init.numbering')}
              value={numbering}
              onChange={setNumbering}
              options={[
                { value: 'sequential', label: t('init.numSequential') },
                { value: 'timestamp', label: t('init.numTimestamp') },
              ]}
            />
          </div>
          <button type="button" className="button primary" disabled={busy} onClick={() => void generate()}>
            {busy ? t('init.working') : t('init.generate')}
          </button>
        </div>
      )}

      {step === 'preview' && plan && (
        <div className="card">
          <h2>{t('init.files')}</h2>
          <p className="muted">
            {plan.targetPath} ·{' '}
            {t('init.summary', {
              create: plan.files.filter((f) => f.action === 'create').length,
              overwrite: plan.files.filter((f) => f.action === 'overwrite').length,
              unchanged: plan.files.filter((f) => f.action === 'unchanged').length,
            })}
          </p>
          <ul className="file-list" data-testid="init-files">
            {plan.files.map((f) => (
              <li key={f.path}>
                <span
                  className={`badge ${f.action === 'overwrite' ? 'warn' : f.action === 'create' ? 'ok' : ''}`}
                >
                  {t(`init.action.${f.action}` as MessageKey)}
                </span>
                <span>{f.path}</span>
              </li>
            ))}
          </ul>
          <p>
            <button type="button" className="button" disabled={busy} onClick={() => void back()}>
              {t('init.back')}
            </button>{' '}
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => (plan.requiresConfirmation ? setConfirming(true) : void apply())}
            >
              {busy ? t('init.working') : t('init.apply')}
            </button>
          </p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="card" data-testid="init-done">
          <h2>✓ {t('init.done')}</h2>
          <p className="muted">{t('init.nextTitle')}</p>
          <ol>
            {result.projectRoot !== '.' && <li>{t('init.next.cd', { dir: result.projectRoot })}</li>}
            <li>{t('init.next.constitution')}</li>
            <li>{t('init.next.specify')}</li>
          </ol>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              reloadProject();
              navigate('/');
            }}
          >
            {t('init.openViewer')}
          </button>
        </div>
      )}

      {confirming && plan && (
        <Dialog
          title={t('init.confirmTitle')}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button type="button" className="button" onClick={() => setConfirming(false)}>
                {t('init.cancel')}
              </button>
              <button type="button" className="button primary" onClick={() => void apply()}>
                {t('init.apply')}
              </button>
            </>
          }
        >
          <p>{t('init.confirmBody', { n: plan.files.filter((f) => f.action === 'overwrite').length })}</p>
        </Dialog>
      )}
    </section>
  );
}
