import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import {
  Attendance,
  describeAuthError,
  DISPUTE_REASONS,
  formatDateTime,
  timeFromNow,
  type AdminDispute,
  type AttendanceRow,
  type DisputeStatus,
  type RecordingView,
} from '@tutora/core';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Facts,
  Kicker,
  Loading,
  PageHeader,
  StatusTag,
  Tabs,
} from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';
import { ReasonDialog } from '../components';
import { moneyKeys, useDisputes, useTutorName } from '../money';

type Filter = DisputeStatus | 'ALL';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED_RELEASE', label: 'Paid to tutor' },
  { value: 'RESOLVED_REFUND', label: 'Refunded' },
  { value: 'ALL', label: 'All' },
];

const attendanceApi = {
  attendance: (id: string) =>
    unwrap<AttendanceRow[]>(
      api.GET('/admin/sessions/{id}/attendance', { params: { path: { id } } }),
    ),
};

function Evidence({ dispute }: { dispute: AdminDispute }) {
  const [watch, setWatch] = useState(false);
  // Opening a recording is audited, so it only loads when staff ask for it.
  const recording = useQuery({
    queryKey: ['admin', 'recording', dispute.sessionId],
    queryFn: () =>
      unwrap<RecordingView>(
        api.GET('/admin/sessions/{id}/recording', {
          params: { path: { id: dispute.sessionId } },
        }),
      ),
    enabled: watch,
    retry: false,
  });
  return (
    <div className="flex flex-col gap-4">
      <Attendance api={attendanceApi} sessionId={dispute.sessionId} />
      {dispute.status === 'OPEN' &&
        (!watch ? (
          <div>
            <Button variant="secondary" onClick={() => setWatch(true)}>
              Open recording
            </Button>
            <p className="mt-1 text-xs text-muted">Viewing is logged in the audit trail.</p>
          </div>
        ) : recording.isPending ? (
          <Loading />
        ) : recording.isError ? (
          <Alert tone="warning">{describeAuthError(recording.error)}</Alert>
        ) : recording.data.url ? (
          <video controls src={recording.data.url} className="w-full bg-black">
            <track kind="captions" />
          </video>
        ) : (
          <Alert tone="info">
            No recording available ({recording.data.status.toLowerCase().replace(/_/g, ' ')}).
          </Alert>
        ))}
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: AdminDispute }) {
  const qc = useQueryClient();
  const tutor = useTutorName(dispute.tutorUserId);
  const [outcome, setOutcome] = useState<'RELEASE' | 'REFUND' | null>(null);
  const [expanded, setExpanded] = useState(dispute.status === 'OPEN');
  const resolve = useMutation({
    mutationFn: ({ outcome, note }: { outcome: 'RELEASE' | 'REFUND'; note: string }) =>
      unwrap<AdminDispute>(
        api.POST('/admin/disputes/{id}/resolve', {
          params: { path: { id: dispute.id } },
          body: { outcome, note },
        }),
      ),
    onSuccess: () => {
      setOutcome(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'disputes'] });
      void qc.invalidateQueries({ queryKey: moneyKeys.all });
    },
  });
  return (
    <li>
      <Card className={dispute.status === 'OPEN' ? 'border-t-8 border-t-danger' : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Kicker className="mb-1">Opened {timeFromNow(dispute.openedAt)}</Kicker>
            <h2 className="text-2xl font-extrabold leading-tight">
              {DISPUTE_REASONS[dispute.reason] ?? dispute.reason}
            </h2>
          </div>
          <StatusTag status={dispute.status} />
        </div>
        {dispute.details && (
          <blockquote className="mt-4 border-l-4 border-text pl-4 font-display text-lg leading-relaxed">
            {dispute.details}
          </blockquote>
        )}
        <div className="mt-5">
          <Facts
            items={[
              ['Tutor', tutor.data ?? dispute.tutorUserId],
              ['Learner', <span className="font-mono text-xs">{dispute.studentUserId}</span>],
              ['Session', <span className="font-mono text-xs">{dispute.sessionId}</span>],
              ['Payment', <span className="font-mono text-xs">{dispute.paymentId}</span>],
              ['Opened', formatDateTime(dispute.openedAt)],
              ...(dispute.resolvedAt
                ? ([
                    ['Decided', formatDateTime(dispute.resolvedAt)],
                    ['Note', dispute.resolutionNote ?? ''],
                  ] as Array<[string, string]>)
                : []),
            ]}
          />
        </div>
        <div className="mt-5">
          <button
            type="button"
            className="link text-sm font-bold"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? 'Hide evidence' : 'Show evidence'}
          </button>
          {expanded && (
            <div className="mt-4">
              <Evidence dispute={dispute} />
            </div>
          )}
        </div>
        {dispute.status === 'OPEN' && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button onClick={() => setOutcome('RELEASE')}>Pay the tutor</Button>
            <Button variant="danger" onClick={() => setOutcome('REFUND')}>
              Refund the learner
            </Button>
          </div>
        )}
      </Card>
      <ReasonDialog
        key={outcome ?? 'none'}
        open={!!outcome}
        title={outcome === 'RELEASE' ? 'Release the money to the tutor?' : 'Refund the learner?'}
        confirmLabel={outcome === 'RELEASE' ? 'Pay the tutor' : 'Refund'}
        danger={outcome === 'REFUND'}
        field="note"
        label="Decision note"
        hint="Both people see this. Kept in the audit log."
        pending={resolve.isPending}
        error={resolve.error}
        onClose={() => {
          setOutcome(null);
          resolve.reset();
        }}
        onConfirm={(note) => outcome && resolve.mutate({ outcome, note })}
      />
    </li>
  );
}

export function DisputesPage() {
  const [filter, setFilter] = useState<Filter>('OPEN');
  const disputes = useDisputes(filter === 'ALL' ? undefined : filter);
  return (
    <>
      <PageHeader
        kicker="Money · Disputes"
        title="Disputed sessions"
        description="The learner's payment stays frozen until you decide. Check attendance and, if needed, the recording."
      />
      <Tabs label="Filter disputes" items={FILTERS} value={filter} onChange={setFilter} />
      {disputes.isPending ? (
        <Loading />
      ) : disputes.isError ? (
        <Alert tone="danger">{disputes.error.message}</Alert>
      ) : disputes.data.length === 0 ? (
        <EmptyState title={filter === 'OPEN' ? 'No open disputes' : 'Nothing here'} />
      ) : (
        <ul className="flex flex-col gap-6">
          {disputes.data.map((d) => (
            <DisputeCard key={d.id} dispute={d} />
          ))}
        </ul>
      )}
    </>
  );
}
