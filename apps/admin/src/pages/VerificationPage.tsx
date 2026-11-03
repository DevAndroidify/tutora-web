import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import {
  describeAuthError,
  formatDate,
  type ProfileReview,
  type ReviewStatus,
  type SkillReview,
  type VerificationStatus,
} from '@tutora/core';
import {
  Alert,
  Button,
  EmptyState,
  Kicker,
  Loading,
  PageHeader,
  StatusTag,
  Tabs,
} from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';
import { ReasonDialog } from '../components';
import { useProfileReviews, useSkillReviews } from '../queries';

type Queue = 'profiles' | 'skills';

export function VerificationPage() {
  const [queue, setQueue] = useState<Queue>('profiles');
  return (
    <>
      <PageHeader
        kicker="Verification"
        title="Who gets to teach"
        description="Approve a tutor's identity and profile once, then each skill claim on its own evidence."
      />
      <Tabs
        label="Queue"
        value={queue}
        onChange={setQueue}
        items={[
          { value: 'profiles', label: 'Tutor profiles' },
          { value: 'skills', label: 'Skill claims' },
        ]}
      />
      {queue === 'profiles' ? <ProfileQueue /> : <SkillQueue />}
    </>
  );
}

function ProfileQueue() {
  const [status, setStatus] = useState<VerificationStatus>('PENDING');
  const list = useProfileReviews(status);
  return (
    <>
      <StatusFilter
        value={status}
        onChange={setStatus}
        options={['PENDING', 'VERIFIED', 'REJECTED', 'NOT_SUBMITTED'] as const}
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Alert tone="danger">{list.error.message}</Alert>
      ) : list.data.length === 0 ? (
        <EmptyState title="Queue is clear">Nothing waiting in this state.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-8">
          {list.data.map((p) => (
            <ProfileItem key={p.userId} profile={p} />
          ))}
        </ul>
      )}
    </>
  );
}

function ProfileItem({ profile: p }: { profile: ProfileReview }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const approve = useMutation({
    mutationFn: (badge: 'VERIFIED' | 'EXPERT') =>
      unwrap(
        api.POST('/admin/tutors/{userId}/verification/approve', {
          params: { path: { userId: p.userId } },
          body: { badge },
        }),
      ),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: (reason: string) =>
      unwrap(
        api.POST('/admin/tutors/{userId}/verification/reject', {
          params: { path: { userId: p.userId } },
          body: { reason },
        }),
      ),
    onSuccess: async () => {
      setRejecting(false);
      await refresh();
    },
  });
  return (
    <li className="border-t-4 border-text bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Kicker className="mb-2">Submitted {formatDate(p.verificationSubmittedAt)}</Kicker>
          <h2 className="text-3xl font-black">{p.fullName}</h2>
          <p className="text-sm text-muted">{p.email}</p>
        </div>
        <StatusTag status={p.verificationStatus} />
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          {p.headline && <p className="font-display text-xl font-bold">{p.headline}</p>}
          {p.bio && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{p.bio}</p>}
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">
            {p.experienceYears ?? '?'} years · {p.languages.join(', ') || 'no languages'} · UPI{' '}
            {p.payoutUpiId ? 'set' : 'missing'}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Skill claims
          </h3>
          <ul className="flex flex-col gap-2">
            {p.skills.map((s) => (
              <li
                key={s.skill.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm"
              >
                <span className="font-semibold">{s.skill.name}</span>
                <StatusTag status={s.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      {(approve.error || reject.error) && (
        <div className="mt-4">
          <Alert tone="danger">{describeAuthError(approve.error ?? reject.error)}</Alert>
        </div>
      )}
      {p.verificationStatus === 'PENDING' && (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            loading={approve.isPending && approve.variables === 'VERIFIED'}
            onClick={() => approve.mutate('VERIFIED')}
          >
            Approve · Verified
          </Button>
          <Button
            variant="secondary"
            loading={approve.isPending && approve.variables === 'EXPERT'}
            onClick={() => approve.mutate('EXPERT')}
          >
            Approve · Expert
          </Button>
          <Button variant="danger" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
      <ReasonDialog
        open={rejecting}
        title={`Reject ${p.fullName}`}
        confirmLabel="Reject profile"
        pending={reject.isPending}
        error={reject.error}
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => reject.mutate(reason)}
      />
    </li>
  );
}

function SkillQueue() {
  const [status, setStatus] = useState<ReviewStatus>('PENDING');
  const list = useSkillReviews(status);
  return (
    <>
      <StatusFilter
        value={status}
        onChange={setStatus}
        options={['PENDING', 'APPROVED', 'REJECTED'] as const}
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Alert tone="danger">{list.error.message}</Alert>
      ) : list.data.length === 0 ? (
        <EmptyState title="Queue is clear">Nothing waiting in this state.</EmptyState>
      ) : (
        <ul className="grid gap-6 lg:grid-cols-2">
          {list.data.map((s) => (
            <SkillItem key={`${s.tutorUserId}:${s.skill.id}`} claim={s} />
          ))}
        </ul>
      )}
    </>
  );
}

function SkillItem({ claim: c }: { claim: SkillReview }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const path = { userId: c.tutorUserId, skillId: c.skill.id };
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const approve = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/admin/tutors/{userId}/skills/{skillId}/approve', { params: { path } })),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: (reason: string) =>
      unwrap(
        api.POST('/admin/tutors/{userId}/skills/{skillId}/reject', {
          params: { path },
          body: { reason },
        }),
      ),
    onSuccess: async () => {
      setRejecting(false);
      await refresh();
    },
  });
  return (
    <li className="flex flex-col border-t-4 border-text bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Kicker className="mb-1">{c.tutorName}</Kicker>
          <h2 className="text-2xl font-black">{c.skill.name}</h2>
        </div>
        <StatusTag status={c.status} />
      </div>
      {c.skill.learnerNotice && (
        <p className="mt-2 border-l-4 border-warning pl-3 text-xs text-muted">
          Notice: {c.skill.learnerNotice}
        </p>
      )}
      <p className="mt-3 text-sm leading-relaxed">{c.summary}</p>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
        {c.experienceYears ?? '?'} years · tutor{' '}
        {c.tutorVerificationStatus.toLowerCase().replace('_', ' ')}
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-xs">
        {c.evidenceLinks.length === 0 && <li className="text-danger">No evidence links</li>}
        {c.evidenceLinks.map((l) => (
          <li key={l} className="truncate">
            <a href={l} target="_blank" rel="noopener noreferrer" className="link">
              {l}
            </a>
          </li>
        ))}
      </ul>
      {(approve.error || reject.error) && (
        <div className="mt-3">
          <Alert tone="danger">{describeAuthError(approve.error ?? reject.error)}</Alert>
        </div>
      )}
      {c.status === 'PENDING' && (
        <div className="mt-auto flex gap-2 pt-4">
          <Button loading={approve.isPending} onClick={() => approve.mutate()}>
            Approve skill
          </Button>
          <Button variant="danger" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
      <ReasonDialog
        open={rejecting}
        title={`Reject ${c.skill.name} for ${c.tutorName}`}
        confirmLabel="Reject claim"
        pending={reject.isPending}
        error={reject.error}
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => reject.mutate(reason)}
      />
    </li>
  );
}

function StatusFilter<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Status">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] ${
            o === value ? 'border-text bg-text text-bg' : 'border-border hover:border-text'
          }`}
        >
          {o.toLowerCase().replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}
