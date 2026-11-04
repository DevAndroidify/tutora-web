import { Link } from '@tanstack/react-router';
import { useSession } from '@tutora/core';
import {
  Alert,
  buttonClass,
  Card,
  Loading,
  PageHeader,
  SectionHeader,
  Stat,
  StatusTag,
} from '@tutora/ui';
import { onboardingSteps, useMyProfile } from '../profile';

export function DashboardPage() {
  const session = useSession();
  const profile = useMyProfile();
  const name = session.status === 'signedIn' ? session.user.fullName.split(' ')[0] : '';
  if (profile.isPending) return <Loading />;
  if (profile.isError) return <Alert tone="danger">{profile.error.message}</Alert>;
  const p = profile.data;
  const steps = onboardingSteps(p);
  const doneCount = steps.filter((s) => s.done).length;
  const approved = p?.skills.filter((s) => s.status === 'APPROVED').length ?? 0;

  return (
    <>
      <PageHeader
        kicker="Tutor desk"
        title={`Good to see you, ${name}.`}
        description={
          p?.verificationStatus === 'VERIFIED'
            ? 'You are verified. Bid on learner requests and groups for your approved skills.'
            : 'Finish these steps to get verified. Only verified tutors can bid on learner requests.'
        }
        actions={
          <Link to="/profile" className={buttonClass('primary')}>
            {p ? 'Edit profile' : 'Create profile'}
          </Link>
        }
      />
      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="steps">
          <SectionHeader id="steps" title={`Road to verification · ${doneCount}/${steps.length}`} />
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-4 border-b border-border py-4">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center font-display text-xl font-black ${
                    s.done ? 'bg-brand text-black' : 'border-2 border-border text-muted'
                  }`}
                  aria-hidden
                >
                  {s.done ? '✓' : i + 1}
                </span>
                <span
                  className={
                    s.done
                      ? 'text-muted line-through decoration-brand decoration-2'
                      : 'font-semibold'
                  }
                >
                  {s.label}
                </span>
                <span className="sr-only">{s.done ? '(done)' : '(to do)'}</span>
              </li>
            ))}
          </ol>
          {p?.verificationStatus === 'REJECTED' && p.verificationRejectionReason && (
            <div className="mt-6">
              <Alert tone="danger" title="Changes needed before approval">
                {p.verificationRejectionReason}
              </Alert>
            </div>
          )}
        </section>
        <aside className="flex flex-col gap-8">
          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Verification
            </p>
            <StatusTag status={p?.verificationStatus ?? 'NOT_SUBMITTED'} />
            {p?.badge && p.badge !== 'NONE' && (
              <p className="mt-3 text-sm">
                Badge: <strong>{p.badge === 'EXPERT' ? 'Expert' : 'Verified'}</strong>
              </p>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-6">
            <Stat label="Skills listed" value={p?.skills.length ?? 0} />
            <Stat label="Approved" value={approved} />
          </div>
          {p?.verificationStatus === 'VERIFIED' && (
            <div className="flex flex-wrap gap-2">
              <Link to="/requests" className={buttonClass('secondary')}>
                Open requests
              </Link>
              <Link to="/groups" className={buttonClass('secondary')}>
                Groups
              </Link>
              <Link to="/earnings" className={buttonClass('secondary')}>
                Earnings
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
