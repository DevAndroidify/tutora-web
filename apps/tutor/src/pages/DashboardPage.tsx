import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import { formatINR, timeFromNow, useSession, type MarketRequest, type Page } from '@tutora/core';
import {
  Alert,
  buttonClass,
  Card,
  Loading,
  PageHeader,
  SectionHeader,
  Stat,
  StatusTag,
  Tag,
} from '@tutora/ui';
import { api } from '../api';
import { onboardingSteps, useMyProfile } from '../profile';
import { marketKey } from './MarketplacePage';

/** The newest few open requests for this tutor's skills, shown on the desk. */
function RequestsForYou() {
  const query = { limit: 3, offset: 0 };
  const list = useQuery({
    queryKey: [...marketKey, query],
    queryFn: () => unwrap<Page<MarketRequest>>(api.GET('/tutor/requests', { params: { query } })),
  });
  return (
    <section aria-labelledby="for-you">
      <SectionHeader
        id="for-you"
        title={list.data ? `Requests for you · ${list.data.total}` : 'Requests for you'}
        action={
          <Link to="/requests" className="link">
            See all
          </Link>
        }
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Alert tone="danger">{list.error.message}</Alert>
      ) : list.data.items.length === 0 ? (
        <Alert tone="info">No open requests for your skills right now. New ones notify you.</Alert>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.data.items.map((r, i) => (
            <li
              key={r.id}
              className={`rounded-[var(--radius-card)] border-2 border-ink bg-surface p-5 ${i === 0 ? 'lift' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Tag tone="neutral">{r.skill.name}</Tag>
                  <Tag tone="neutral">{r.level.charAt(0) + r.level.slice(1).toLowerCase()}</Tag>
                </div>
                <span className="text-sm text-muted">
                  {r.bidCount} {r.bidCount === 1 ? 'offer' : 'offers'} so far
                  {r.expiresAt ? ` · closes ${timeFromNow(r.expiresAt)}` : ''}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-extrabold leading-tight">{r.title}</h3>
              <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-muted">
                {r.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm">
                  {r.studentDisplayName}
                  {r.budgetHintPaise ? ` · ~${formatINR(r.budgetHintPaise)}` : ''}
                  {r.preferredLanguage ? ` · ${r.preferredLanguage}` : ''}
                </span>
                {r.myBid ? (
                  <Tag tone="success">You made an offer</Tag>
                ) : (
                  <Link
                    to="/requests/$id"
                    params={{ id: r.id }}
                    className={buttonClass(i === 0 ? 'primary' : 'secondary')}
                  >
                    Make an offer
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
  const verified = p?.verificationStatus === 'VERIFIED';

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
        {verified ? (
          <RequestsForYou />
        ) : (
          <section aria-labelledby="steps">
            <SectionHeader
              id="steps"
              title={`Road to verification · ${doneCount}/${steps.length}`}
            />
            <ol className="flex flex-col">
              {steps.map((s, i) => (
                <li key={s.label} className="flex items-center gap-4 border-b border-border py-4">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink font-display text-lg font-extrabold ${
                      s.done ? 'bg-brand text-[#16161a]' : 'bg-surface text-muted'
                    }`}
                    aria-hidden
                  >
                    {s.done ? '✓' : i + 1}
                  </span>
                  <span className={s.done ? 'text-muted line-through' : 'font-semibold'}>
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
        )}
        <aside className="flex flex-col gap-6">
          <Card>
            <p className="mb-3 text-sm font-bold text-muted">Verification</p>
            <StatusTag status={p?.verificationStatus ?? 'NOT_SUBMITTED'} />
            {p?.badge && p.badge !== 'NONE' && (
              <p className="mt-3 text-sm">
                Badge: <strong>{p.badge === 'EXPERT' ? 'Expert' : 'Verified'}</strong>
              </p>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Skills listed" value={p?.skills.length ?? 0} />
            <Stat label="Approved" value={approved} />
          </div>
          {verified && (
            <section className="rounded-[var(--radius-card)] border-2 border-ink bg-surface p-5 text-[15px]">
              <h2 className="text-lg font-extrabold">How offers get ranked</h2>
              <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                <dt>Learner results</dt>
                <dd className="font-bold">40%</dd>
                <dt>How soon you can start</dt>
                <dd className="font-bold">25%</dd>
                <dt>Showing up on time</dt>
                <dd className="font-bold">20%</dd>
                <dt>Price</dt>
                <dd className="font-bold">15%</dd>
              </dl>
              <p className="mt-2 text-sm text-muted">
                New tutors start in the middle on learner results until they have some.
              </p>
            </section>
          )}
          {verified && (
            <div className="flex flex-wrap gap-2">
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
