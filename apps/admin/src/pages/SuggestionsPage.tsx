import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import {
  describeAuthError,
  formatDate,
  type ReviewStatus,
  type SkillSuggestion,
} from '@tutora/core';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Kicker,
  Loading,
  Modal,
  PageHeader,
  StatusTag,
  Tabs,
  Textarea,
} from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';
import { fieldErr, ReasonDialog, topError } from '../components';
import { useAdminCategories, useSuggestions } from '../queries';

export function SuggestionsPage() {
  const [status, setStatus] = useState<ReviewStatus>('PENDING');
  const list = useSuggestions(status);
  const categories = useAdminCategories();
  const categoryName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? '…';
  return (
    <>
      <PageHeader
        kicker="Catalog"
        title="Skill suggestions"
        description="Tutors propose skills that are missing. Approving one creates it in the catalog."
      />
      <Tabs
        label="Status"
        value={status}
        onChange={setStatus}
        items={[
          { value: 'PENDING', label: 'Waiting' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
        ]}
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Alert tone="danger">{list.error.message}</Alert>
      ) : list.data.length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {list.data.map((s) => (
            <SuggestionItem key={s.id} suggestion={s} section={categoryName(s.categoryId)} />
          ))}
        </ul>
      )}
    </>
  );
}

function SuggestionItem({
  suggestion: s,
  section,
}: {
  suggestion: SkillSuggestion;
  section: string;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [name, setName] = useState(s.name);
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const done = async () => {
    setMode(null);
    await qc.invalidateQueries({ queryKey: ['admin'] });
    await qc.invalidateQueries({ queryKey: ['public'] });
  };
  const approve = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/admin/catalog/skill-suggestions/{id}/approve', {
          params: { path: { id: s.id } },
          body: {
            name: name.trim(),
            learnerNotice: notice.trim() || undefined,
            note: note.trim() || undefined,
          },
        }),
      ),
    onSuccess: done,
  });
  const reject = useMutation({
    mutationFn: (reason: string) =>
      unwrap(
        api.POST('/admin/catalog/skill-suggestions/{id}/reject', {
          params: { path: { id: s.id } },
          body: { reason },
        }),
      ),
    onSuccess: done,
  });
  return (
    <li className="flex flex-col border-t-4 border-text bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Kicker className="mb-1">
            {section} · {formatDate(s.createdAt)}
          </Kicker>
          <h2 className="text-2xl font-extrabold">{s.name}</h2>
        </div>
        <StatusTag status={s.status} />
      </div>
      {s.description && <p className="mt-2 text-sm leading-relaxed">{s.description}</p>}
      {s.decisionNote && <p className="mt-2 text-xs text-muted">Note: {s.decisionNote}</p>}
      {s.status === 'PENDING' && (
        <div className="mt-auto flex gap-2 pt-4">
          <Button onClick={() => setMode('approve')}>Approve</Button>
          <Button variant="danger" onClick={() => setMode('reject')}>
            Reject
          </Button>
        </div>
      )}
      <Modal
        open={mode === 'approve'}
        title={`Add “${s.name}” to the catalog`}
        onClose={() => setMode(null)}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            approve.mutate();
          }}
        >
          {topError(approve.error) && (
            <Alert tone="danger">{describeAuthError(approve.error)}</Alert>
          )}
          <Field
            label="Skill name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            error={fieldErr(approve.error, 'name')}
          />
          <Textarea
            label="Learner notice (optional)"
            rows={2}
            maxLength={500}
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            error={fieldErr(approve.error, 'learnerNotice')}
          />
          <Field
            label="Note to the tutor (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={approve.isPending} disabled={name.trim().length < 2}>
              Approve and create
            </Button>
          </div>
        </form>
      </Modal>
      <ReasonDialog
        open={mode === 'reject'}
        title={`Reject “${s.name}”`}
        confirmLabel="Reject suggestion"
        pending={reject.isPending}
        error={reject.error}
        onClose={() => setMode(null)}
        onConfirm={(reason) => reject.mutate(reason)}
      />
    </li>
  );
}
