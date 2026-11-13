import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import {
  describeAuthError,
  formatDateTime,
  humanize,
  REPORT_REASONS,
  useSession,
  type CaseAction,
  type CaseDetail,
  type Sanction,
} from '@tutora/core';
import {
  Alert,
  Button,
  Card,
  Facts,
  Field,
  Kicker,
  Loading,
  SectionHeader,
  Select,
  StatusTag,
  Tag,
  Textarea,
} from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';
import { fieldErr, ReasonDialog, topError } from '../components';

const ACTIONS: Array<{ value: CaseAction; label: string; timed?: boolean }> = [
  { value: 'DISMISS', label: 'Dismiss: no violation' },
  { value: 'WARN', label: 'Warn' },
  { value: 'RESTRICT_POSTING', label: 'Restrict posting requests', timed: true },
  { value: 'RESTRICT_BIDDING', label: 'Restrict bidding', timed: true },
  { value: 'SUSPEND', label: 'Suspend account', timed: true },
  { value: 'BAN', label: 'Ban permanently' },
];

export function CaseDetailPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const session = useSession();
  const detail = useQuery({
    queryKey: ['admin', 'case', id],
    queryFn: () =>
      unwrap<CaseDetail>(api.GET('/admin/moderation/cases/{id}', { params: { path: { id } } })),
  });
  const set = (d: CaseDetail) => {
    qc.setQueryData(['admin', 'case', id], d);
    void qc.invalidateQueries({ queryKey: ['admin', 'cases'] });
  };
  const assign = useMutation({
    mutationFn: () =>
      unwrap<CaseDetail>(
        api.POST('/admin/moderation/cases/{id}/assign', { params: { path: { id } } }),
      ),
    onSuccess: set,
  });

  if (detail.isPending) return <Loading />;
  if (detail.isError) return <Alert tone="danger">{detail.error.message}</Alert>;
  const d = detail.data;
  const me = session.status === 'signedIn' ? session.user.id : null;
  const open = d.case.status === 'OPEN';

  return (
    <article className="flex flex-col gap-10">
      <header className="border-b-4 border-text pb-6">
        <Link to="/cases" className="link text-xs">
          ← All cases
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Kicker>Case · priority {d.case.priority}</Kicker>
          <StatusTag status={d.case.status} />
          {d.case.assignedTo && (
            <Tag tone="dark">{d.case.assignedTo === me ? 'Assigned to you' : 'Assigned'}</Tag>
          )}
        </div>
        <h1 className="mt-2 text-5xl font-extrabold leading-[1.02]">{d.subject.fullName}</h1>
        <p className="mt-2 text-sm text-muted">
          {d.subject.email} · account <strong>{d.subject.status.toLowerCase()}</strong> ·{' '}
          {d.history.strikes} past {d.history.strikes === 1 ? 'strike' : 'strikes'},{' '}
          {d.history.dismissed} dismissed
        </p>
        {open && d.case.assignedTo !== me && (
          <div className="mt-5">
            <Button variant="secondary" loading={assign.isPending} onClick={() => assign.mutate()}>
              Assign to me
            </Button>
          </div>
        )}
        {assign.error && <Alert tone="danger">{describeAuthError(assign.error)}</Alert>}
      </header>

      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="reports">
            <SectionHeader id="reports" title={`Reports · ${d.reports.length}`} />
            {d.reports.length === 0 && <p className="text-sm text-muted">No member reports.</p>}
            <ul className="flex flex-col gap-4">
              {d.reports.map((r) => (
                <li key={r.id} className="border-l-4 border-danger bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{REPORT_REASONS[r.reason] ?? humanize(r.reason)}</p>
                    <Tag>from {r.reportedFromApp}</Tag>
                    {r.entityType && <Tag>{humanize(r.entityType)}</Tag>}
                  </div>
                  {r.details && <p className="mt-2 text-sm leading-relaxed">{r.details}</p>}
                  <p className="mt-2 text-xs text-muted">{formatDateTime(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="flags">
            <SectionHeader id="flags" title={`Automatic flags · ${d.flags.length}`} />
            {d.flags.length === 0 && <p className="text-sm text-muted">No automatic flags.</p>}
            <ul className="flex flex-col gap-4">
              {d.flags.map((f) => (
                <li key={f.id} className="border-l-4 border-warning bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{humanize(f.rule)}</p>
                    <Tag tone={f.severity === 'HIGH' ? 'danger' : 'warning'}>{f.severity}</Tag>
                    <Tag>{humanize(f.action)}</Tag>
                  </div>
                  {f.excerpt && (
                    <blockquote className="mt-2 border-l-2 border-border pl-3 font-display italic">
                      “{f.excerpt}”
                    </blockquote>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    {humanize(f.entityType)} · {f.field} · {formatDateTime(f.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="log">
            <SectionHeader id="log" title="Decision log" />
            {d.actions.length === 0 ? (
              <p className="text-sm text-muted">No decisions yet.</p>
            ) : (
              <ol className="flex flex-col">
                {d.actions.map((a) => (
                  <li key={a.id} className="border-b border-border py-3 text-sm">
                    <strong>{humanize(a.action)}</strong>
                    {a.durationDays ? ` for ${a.durationDays} days` : ''}: {a.reason}
                    <span className="block text-xs text-muted">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <aside className="flex flex-col gap-8">
          {open ? (
            <ActionForm caseId={d.case.id} onDone={set} />
          ) : (
            <Card>
              <Facts
                items={[
                  ['Closed', formatDateTime(d.case.closedAt)],
                  ['Resolution', d.case.resolution ?? '—'],
                ]}
              />
            </Card>
          )}
          <Sanctions
            sanctions={d.sanctions}
            onLifted={() => void qc.invalidateQueries({ queryKey: ['admin', 'case', id] })}
          />
        </aside>
      </div>
    </article>
  );
}

function ActionForm({ caseId, onDone }: { caseId: string; onDone: (d: CaseDetail) => void }) {
  const [action, setAction] = useState<CaseAction>('WARN');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const timed = ACTIONS.find((a) => a.value === action)?.timed;
  const act = useMutation({
    mutationFn: () =>
      unwrap<CaseDetail>(
        api.POST('/admin/moderation/cases/{id}/actions', {
          params: { path: { id: caseId } },
          body: {
            action,
            reason: reason.trim(),
            durationDays: timed && days ? Number(days) : undefined,
          },
        }),
      ),
    onSuccess: (d) => {
      setReason('');
      onDone(d);
    },
  });
  const severe = action === 'SUSPEND' || action === 'BAN';
  return (
    <Card className="border-t-8 border-t-brand">
      <h2 className="mb-4 text-2xl font-extrabold">Decide</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            severe &&
            !window.confirm(
              `${humanize(action)} this account? They will be signed out of every app.`,
            )
          )
            return;
          act.mutate();
        }}
      >
        {topError(act.error) && <Alert tone="danger">{topError(act.error)}</Alert>}
        <Select
          label="Action"
          value={action}
          onChange={(e) => setAction(e.target.value as CaseAction)}
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
        {timed && (
          <Field
            label="Days (blank = until lifted)"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            error={fieldErr(act.error, 'durationDays')}
          />
        )}
        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="Recorded in the audit log and shown to the member."
          error={fieldErr(act.error, 'reason')}
        />
        <Button
          type="submit"
          variant={severe ? 'danger' : 'primary'}
          loading={act.isPending}
          disabled={!reason.trim()}
        >
          Record decision
        </Button>
      </form>
    </Card>
  );
}

function Sanctions({ sanctions, onLifted }: { sanctions: Sanction[]; onLifted: () => void }) {
  const [lifting, setLifting] = useState<Sanction | null>(null);
  const lift = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        api.POST('/admin/moderation/sanctions/{id}/lift', {
          params: { path: { id } },
          body: { reason },
        }),
      ),
    onSuccess: () => {
      setLifting(null);
      onLifted();
    },
  });
  return (
    <section aria-labelledby="sanctions">
      <SectionHeader id="sanctions" title="Sanctions" />
      {sanctions.length === 0 && <p className="text-sm text-muted">None.</p>}
      <ul className="flex flex-col gap-3">
        {sanctions.map((s) => {
          const active = !s.liftedAt && (!s.endsAt || new Date(s.endsAt) > new Date());
          return (
            <li key={s.id} className="border border-border bg-surface p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>{humanize(s.type)}</strong>
                <Tag tone={active ? 'danger' : 'neutral'}>
                  {active ? 'Active' : s.liftedAt ? 'Lifted' : 'Ended'}
                </Tag>
              </div>
              <p className="mt-1 text-muted">{s.reason}</p>
              <p className="mt-1 text-xs text-muted">
                {formatDateTime(s.startsAt)} → {s.endsAt ? formatDateTime(s.endsAt) : 'no end'}
              </p>
              {active && s.type !== 'WARN' && (
                <Button variant="ghost" className="mt-2" onClick={() => setLifting(s)}>
                  Lift
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <ReasonDialog
        open={!!lifting}
        title={`Lift ${lifting ? humanize(lifting.type).toLowerCase() : ''}`}
        confirmLabel="Lift sanction"
        danger={false}
        pending={lift.isPending}
        error={lift.error}
        onClose={() => setLifting(null)}
        onConfirm={(reason) => lifting && lift.mutate({ id: lifting.id, reason })}
      />
    </section>
  );
}
