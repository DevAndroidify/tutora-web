import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import { formatDateTime, formatINR, timeFromNow, type Bid, type BidStatus } from '@tutora/core';
import { Alert, EmptyState, Loading, PageHeader, StatusTag, Tabs } from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';

type Filter = 'ALL' | BidStatus;

export function BidsPage() {
  const [status, setStatus] = useState<Filter>('SUBMITTED');
  const bids = useQuery({
    queryKey: ['tutor', 'bids', status],
    queryFn: () =>
      unwrap<Bid[]>(
        api.GET('/tutor/bids', {
          params: { query: { status: status === 'ALL' ? undefined : status } },
        }),
      ),
  });
  return (
    <>
      <PageHeader kicker="Marketplace" title="My bids" />
      <Tabs
        label="Status"
        value={status}
        onChange={setStatus}
        items={[
          { value: 'SUBMITTED', label: 'Waiting' },
          { value: 'ACCEPTED', label: 'Accepted' },
          { value: 'WITHDRAWN', label: 'Withdrawn' },
          { value: 'EXPIRED', label: 'Expired' },
          { value: 'REJECTED', label: 'Not chosen' },
          { value: 'ALL', label: 'All' },
        ]}
      />
      {bids.isPending ? (
        <Loading />
      ) : bids.isError ? (
        <Alert tone="danger">{bids.error.message}</Alert>
      ) : bids.data.length === 0 ? (
        <EmptyState title="No bids here">
          <Link to="/requests" className="link">
            Browse open requests
          </Link>
        </EmptyState>
      ) : (
        <ul>
          {bids.data.map((b) => (
            <li key={b.id} className="border-t border-border first:border-t-2 first:border-text">
              <Link
                to="/requests/$id"
                params={{ id: b.requestId }}
                className="story flex flex-wrap items-center gap-6 py-5"
              >
                <span className="w-32 font-display text-3xl font-extrabold">
                  {formatINR(b.seatPricePaise)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="story-title font-semibold">
                    {formatDateTime(b.proposedStartAt)} · {b.durationMinutes} min
                  </p>
                  <p className="truncate text-sm text-muted">{b.approachText}</p>
                  <p className="mt-1 text-xs text-muted">updated {timeFromNow(b.updatedAt)}</p>
                </div>
                <StatusTag status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
