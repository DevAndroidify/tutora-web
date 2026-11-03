import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import {
  formatINR,
  timeFromNow,
  type LearningRequest,
  type Page,
  type RequestStatus,
} from '@tutora/core';
import {
  Alert,
  buttonClass,
  EmptyState,
  Kicker,
  Loading,
  PageHeader,
  Pagination,
  StatusTag,
  Tabs,
} from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';

type Filter = 'ALL' | RequestStatus;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'OPEN', label: 'Taking bids' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function RequestsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [offset, setOffset] = useState(0);
  const query = { limit: 20, offset, status: filter === 'ALL' ? undefined : filter };
  const list = useQuery({
    queryKey: ['requests', query],
    queryFn: () =>
      unwrap<Page<LearningRequest>>(api.GET('/student/requests', { params: { query } })),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader
        kicker="Your desk"
        title="My requests"
        actions={
          <Link to="/requests/new" className={buttonClass('primary')}>
            New request
          </Link>
        }
      />
      <Tabs
        label="Filter by status"
        items={FILTERS}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setOffset(0);
        }}
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Alert tone="danger">{list.error.message}</Alert>
      ) : list.data.items.length === 0 ? (
        <EmptyState title={filter === 'ALL' ? 'No requests yet' : 'Nothing here'}>
          {filter === 'ALL' && (
            <Link to="/requests/new" className="link">
              Post your first request
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <ul>
            {list.data.items.map((r) => (
              <li key={r.id} className="border-t border-border first:border-t-2 first:border-text">
                <Link
                  to="/requests/$id"
                  params={{ id: r.id }}
                  className="story grid gap-2 py-5 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <Kicker className="mb-1">{r.skill.name}</Kicker>
                    <h2 className="story-title text-2xl font-black leading-tight">{r.title}</h2>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                      {r.level.toLowerCase()} · budget {formatINR(r.budgetHintPaise)} ·{' '}
                      {r.status === 'OPEN' && r.expiresAt
                        ? `bids close ${timeFromNow(r.expiresAt)}`
                        : `created ${timeFromNow(r.createdAt)}`}
                    </p>
                  </div>
                  <StatusTag status={r.status} />
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
    </>
  );
}
