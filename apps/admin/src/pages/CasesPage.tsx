import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import { timeFromNow, type CaseStatus } from '@tutora/core';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatusTag,
  Tabs,
  Tag,
  Textarea,
} from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';
import { fieldErr, topError } from '../components';
import { useCases } from '../queries';

export function CasesPage() {
  const [status, setStatus] = useState<CaseStatus>('OPEN');
  const [opening, setOpening] = useState(false);
  const cases = useCases(status);
  return (
    <>
      <PageHeader
        kicker="Trust & safety"
        title="Cases"
        description="Reports from learners and tutors, plus automatic flags (contact sharing, stock tips), grouped per person."
        actions={
          <Button variant="secondary" onClick={() => setOpening(true)}>
            Open a case
          </Button>
        }
      />
      <Tabs
        label="Status"
        value={status}
        onChange={setStatus}
        items={[
          { value: 'OPEN', label: 'Open' },
          { value: 'ACTIONED', label: 'Actioned' },
          { value: 'DISMISSED', label: 'Dismissed' },
        ]}
      />
      {cases.isPending ? (
        <Loading />
      ) : cases.isError ? (
        <Alert tone="danger">{cases.error.message}</Alert>
      ) : cases.data.length === 0 ? (
        <EmptyState title={status === 'OPEN' ? 'No open cases' : 'Nothing here'} />
      ) : (
        <ul>
          {[...cases.data]
            .sort(
              (a, b) => b.priority - a.priority || b.lastActivityAt.localeCompare(a.lastActivityAt),
            )
            .map((c) => (
              <li key={c.id} className="border-t border-border first:border-t-2 first:border-text">
                <Link
                  to="/cases/$id"
                  params={{ id: c.id }}
                  className="story grid gap-2 py-5 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-6"
                >
                  <span
                    className={`flex size-12 items-center justify-center font-display text-2xl font-extrabold ${
                      c.priority >= 7
                        ? 'bg-danger text-white'
                        : c.priority >= 4
                          ? 'bg-brand text-black'
                          : 'border-2 border-border'
                    }`}
                    title="Priority"
                  >
                    {c.priority}
                  </span>
                  <div>
                    <h2 className="story-title text-2xl font-extrabold">{c.subjectName}</h2>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {c.reportCount} {c.reportCount === 1 ? 'report' : 'reports'} · {c.flagCount}{' '}
                      {c.flagCount === 1 ? 'flag' : 'flags'} · active{' '}
                      {timeFromNow(c.lastActivityAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!c.assignedTo && c.status === 'OPEN' && <Tag tone="warning">Unassigned</Tag>}
                    <StatusTag status={c.status} />
                  </div>
                </Link>
              </li>
            ))}
        </ul>
      )}
      {opening && <OpenCaseDialog onClose={() => setOpening(false)} />}
    </>
  );
}

function OpenCaseDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [subjectUserId, setSubject] = useState('');
  const [note, setNote] = useState('');
  const open = useMutation({
    mutationFn: () =>
      unwrap<{ case: { id: string } } | { id: string }>(
        api.POST('/admin/moderation/cases', {
          body: { subjectUserId: subjectUserId.trim(), note: note.trim() },
        }),
      ),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin', 'cases'] });
      const id = 'case' in res ? res.case.id : res.id;
      await navigate({ to: '/cases/$id', params: { id } });
    },
  });
  return (
    <Modal open title="Open a case" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          open.mutate();
        }}
      >
        {topError(open.error) && <Alert tone="danger">{topError(open.error)}</Alert>}
        <Field
          label="User ID"
          value={subjectUserId}
          onChange={(e) => setSubject(e.target.value)}
          hint="From the user's profile link or a report."
          error={fieldErr(open.error, 'subjectUserId')}
        />
        <Textarea
          label="Why"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={fieldErr(open.error, 'note')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={open.isPending}
            disabled={!subjectUserId.trim() || !note.trim()}
          >
            Open case
          </Button>
        </div>
      </form>
    </Modal>
  );
}
