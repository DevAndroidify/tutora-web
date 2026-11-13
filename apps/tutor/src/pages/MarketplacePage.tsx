import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError, unwrap } from '@tutora/api-client';
import {
  formatINR,
  timeFromNow,
  useRealtime,
  useRealtimeEvent,
  type Level,
  type MarketRequest,
  type Page,
} from '@tutora/core';
import {
  Alert,
  buttonClass,
  EmptyState,
  Kicker,
  Loading,
  PageHeader,
  Pagination,
  Select,
  Tag,
} from '@tutora/ui';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useMyProfile } from '../profile';

export const marketKey = ['tutor', 'market'] as const;

/** Learners' open requests for skills this tutor is approved to teach. */
export function MarketplacePage() {
  const qc = useQueryClient();
  const realtime = useRealtime();
  const profile = useMyProfile();
  const [skillId, setSkillId] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [offset, setOffset] = useState(0);
  const query = { limit: 20, offset, skillId: skillId || undefined, level: level || undefined };
  const list = useQuery({
    queryKey: [...marketKey, query],
    queryFn: () => unwrap<Page<MarketRequest>>(api.GET('/tutor/requests', { params: { query } })),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // Live bid counts for what is on screen (tutors only ever see counts, never prices).
  const ids = list.data?.items.map((r) => r.id).join(',') ?? '';
  useEffect(() => {
    if (!realtime || !ids) return;
    const leave = ids.split(',').map((id) => realtime.subscribe(`request:${id}:tutors`));
    return () => leave.forEach((l) => l());
  }, [realtime, ids]);
  useRealtimeEvent<{ requestId: string; bidCount: number }>(
    'request.bid_count_changed',
    ({ requestId, bidCount }) =>
      qc.setQueriesData<Page<MarketRequest>>({ queryKey: marketKey }, (page) =>
        page
          ? { ...page, items: page.items.map((r) => (r.id === requestId ? { ...r, bidCount } : r)) }
          : page,
      ),
  );
  useRealtimeEvent(
    ['request.closed', 'request.reopened'],
    () => void qc.invalidateQueries({ queryKey: marketKey }),
  );
  useRealtimeEvent<{ type: string }>('notification.created', (n) => {
    if (n.type.startsWith('request.')) void qc.invalidateQueries({ queryKey: marketKey });
  });

  const approved = profile.data?.skills.filter((s) => s.status === 'APPROVED') ?? [];
  const notVerified = list.error instanceof ApiError && list.error.code === 'TUTOR_NOT_VERIFIED';

  return (
    <>
      <PageHeader
        kicker="Marketplace"
        title="Open requests"
        description="Learners who want what you teach. Bids are sealed: other tutors see how many bids there are, never the prices."
      />
      {notVerified ? (
        <Alert tone="warning" title="Get verified to see requests">
          Only verified tutors can browse and bid.{' '}
          <Link to="/profile" className="link">
            Finish your profile
          </Link>
        </Alert>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 md:max-w-xl">
            <Select
              label="Skill"
              value={skillId}
              onChange={(e) => {
                setSkillId(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All my approved skills</option>
              {approved.map((s) => (
                <option key={s.skill.id} value={s.skill.id}>
                  {s.skill.name}
                </option>
              ))}
            </Select>
            <Select
              label="Level"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value as Level | '');
                setOffset(0);
              }}
            >
              <option value="">Any level</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </Select>
          </div>
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <Alert tone="danger">{list.error.message}</Alert>
          ) : list.data.items.length === 0 ? (
            <EmptyState title="No open requests right now">
              New requests for your skills appear here and in your notifications.
            </EmptyState>
          ) : (
            <>
              <ul className="grid gap-4 md:grid-cols-2">
                {list.data.items.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-[var(--radius-card)] border-2 border-ink bg-surface px-5"
                  >
                    <Link
                      to="/requests/$id"
                      params={{ id: r.id }}
                      className="story flex h-full flex-col py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Kicker>
                          {r.skill.name} · {r.level.toLowerCase()}
                        </Kicker>
                        {r.myBid ? <Tag tone="success">You bid</Tag> : null}
                      </div>
                      <h2 className="story-title mt-2 text-2xl font-extrabold leading-tight">
                        {r.title}
                      </h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                        {r.description}
                      </p>
                      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
                        <p className="text-xs font-semibold text-muted">
                          {r.studentDisplayName} · budget {formatINR(r.budgetHintPaise)}
                          {r.expiresAt ? ` · closes ${timeFromNow(r.expiresAt)}` : ''}
                        </p>
                        <p className="text-right">
                          <span className="font-display text-3xl font-extrabold leading-none">
                            {r.bidCount}
                          </span>
                          <span className="block text-xs font-bold text-muted">
                            {r.bidCount === 1 ? 'bid' : 'bids'}
                          </span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination
                total={list.data.total}
                limit={list.data.limit}
                offset={list.data.offset}
                onChange={setOffset}
              />
            </>
          )}
          <p className="mt-10">
            <Link to="/bids" className={buttonClass('secondary')}>
              My bids
            </Link>
          </p>
        </>
      )}
    </>
  );
}
