import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import {
  describeAuthError,
  formatDateTime,
  formatINR,
  useRealtimeEvent,
  useRoom,
  type LearningRequest,
  type RankedBid,
  type SessionSeat,
} from '@tutora/core';
import {
  Alert,
  Button,
  buttonClass,
  EmptyState,
  Loading,
  Modal,
  SectionHeader,
  Select,
  Tag,
} from '@tutora/ui';
import { useState } from 'react';
import { api, sessionApi } from '../api';

type Sort = 'score' | 'price' | 'time';

/** Sealed bids for the learner's own request: ranked, explained, and acceptable. */
export function BidsSection({ request }: { request: LearningRequest }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sort, setSort] = useState<Sort>('score');
  const [choosing, setChoosing] = useState<RankedBid | null>(null);
  const open = request.status === 'OPEN';
  const bids = useQuery({
    queryKey: ['request', request.id, 'bids', sort],
    queryFn: () =>
      unwrap<RankedBid[]>(
        api.GET('/student/requests/{id}/bids', {
          params: { path: { id: request.id }, query: { sort } },
        }),
      ),
  });
  const sessions = useQuery({
    queryKey: ['student', 'sessions'],
    queryFn: sessionApi.list,
    enabled: !open,
  });
  const booked = sessions.data?.find((s) => s.requestId === request.id);

  // New, changed and withdrawn bids arrive live in the owner's room.
  useRoom(open ? `request:${request.id}:owner` : null);
  useRealtimeEvent<{ requestId: string }>(
    ['bid.created', 'bid.updated', 'bid.withdrawn', 'request.closed'],
    (e) => {
      if (e.requestId !== request.id) return;
      void qc.invalidateQueries({ queryKey: ['request', request.id] });
    },
  );

  const accept = useMutation({
    mutationFn: (bidId: string) =>
      unwrap<SessionSeat>(
        api.POST('/student/bids/{id}/accept', { params: { path: { id: bidId } } }),
      ),
    onSuccess: async (seat) => {
      await qc.invalidateQueries({ queryKey: ['student', 'sessions'] });
      await qc.invalidateQueries({ queryKey: ['request', request.id] });
      await navigate({ to: '/sessions/$id', params: { id: seat.sessionId } });
    },
  });

  return (
    <section aria-labelledby="bids">
      <SectionHeader
        id="bids"
        title={`Sealed bids${bids.data ? ` · ${bids.data.length}` : ''}`}
        action={
          bids.data && bids.data.length > 1 ? (
            <Select
              label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="w-44"
            >
              <option value="score">Best match</option>
              <option value="price">Lowest price</option>
              <option value="time">Soonest start</option>
            </Select>
          ) : undefined
        }
      />
      {booked && (
        <div className="mb-6">
          <Alert
            tone="success"
            title={
              booked.sessionStatus === 'PENDING_PAYMENT' ? 'Seat held: pay to confirm' : 'Booked'
            }
          >
            <Link to="/sessions/$id" params={{ id: booked.sessionId }} className="link">
              {booked.sessionStatus === 'PENDING_PAYMENT' ? 'Go to payment' : 'Open your session'}
            </Link>
          </Alert>
        </div>
      )}
      {bids.isPending ? (
        <Loading />
      ) : bids.isError ? (
        <Alert tone="danger">{bids.error.message}</Alert>
      ) : bids.data.length === 0 ? (
        <EmptyState title={open ? 'No bids yet' : 'No bids'}>
          {open
            ? "Verified tutors for this skill have been told. Bids appear here as they arrive; you don't need to refresh."
            : null}
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-6">
          {bids.data.map((b, i) => (
            <BidCard
              key={b.id}
              bid={b}
              rank={sort === 'score' ? i + 1 : null}
              canAccept={open && b.status === 'SUBMITTED'}
              onAccept={() => setChoosing(b)}
            />
          ))}
        </ol>
      )}
      <Modal open={!!choosing} title="Accept this bid?" onClose={() => setChoosing(null)}>
        {choosing && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              <strong>{choosing.tutor.fullName}</strong> · {formatINR(choosing.seatPricePaise)} ·{' '}
              {formatDateTime(choosing.proposedStartAt)}, {choosing.durationMinutes} min.
            </p>
            <p className="text-sm text-muted">
              Your seat is held for a few minutes while you pay by UPI. The money is held by Tutora
              and released to the tutor only after the session. Other bids are closed.
            </p>
            {accept.error && <Alert tone="danger">{describeAuthError(accept.error)}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setChoosing(null)}>
                Not yet
              </Button>
              <Button loading={accept.isPending} onClick={() => accept.mutate(choosing.id)}>
                Accept and pay
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

function BidCard({
  bid: b,
  rank,
  canAccept,
  onAccept,
}: {
  bid: RankedBid;
  rank: number | null;
  canAccept: boolean;
  onAccept: () => void;
}) {
  const [why, setWhy] = useState(false);
  return (
    <li className="grid gap-6 border-t-4 border-text bg-surface p-6 md:grid-cols-[auto_1fr_auto]">
      {rank !== null && (
        <span className="font-display text-6xl font-black leading-none text-brand">{rank}</span>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/tutors/$userId"
            params={{ userId: b.tutor.userId }}
            className="font-display text-2xl font-black hover:underline"
          >
            {b.tutor.fullName}
          </Link>
          {b.tutor.badge !== 'NONE' && (
            <Tag tone={b.tutor.badge === 'EXPERT' ? 'dark' : 'brand'}>
              {b.tutor.badge.toLowerCase()}
            </Tag>
          )}
          {b.status !== 'SUBMITTED' && <Tag>{b.status.toLowerCase()}</Tag>}
        </div>
        {b.tutor.headline && <p className="text-sm text-muted">{b.tutor.headline}</p>}
        <p className="mt-3 text-sm font-semibold">
          {formatDateTime(b.proposedStartAt)} · {b.durationMinutes} min
        </p>
        {b.approachText && (
          <p className="mt-2 whitespace-pre-line font-display text-lg leading-relaxed">
            {b.approachText}
          </p>
        )}
        {b.approachMediaUrl && (
          <a
            href={b.approachMediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link mt-2 inline-block text-sm"
          >
            Watch the tutor&apos;s intro
          </a>
        )}
        <button
          type="button"
          aria-expanded={why}
          onClick={() => setWhy(!why)}
          className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-muted hover:text-text"
        >
          {why ? '▾' : '▸'} Why this ranking · match {Math.round(b.score.total * 100)}%
        </button>
        {why && (
          <ul className="mt-3 flex flex-col gap-2">
            {b.score.components.map((c) => (
              <li key={c.key} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">{c.label}</span>
                  <span className="text-muted">
                    {Math.round(c.value * 100)}% · weight {Math.round(c.weight * 100)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 bg-border" aria-hidden>
                  <div
                    className="h-full bg-brand"
                    style={{ width: `${Math.round(c.value * 100)}%` }}
                  />
                </div>
                {c.note && <p className="mt-1 text-xs text-muted">{c.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col items-start gap-3 md:items-end">
        <p className="font-display text-4xl font-black">{formatINR(b.seatPricePaise)}</p>
        {canAccept && (
          <button type="button" className={buttonClass('primary')} onClick={onAccept}>
            Accept
          </button>
        )}
      </div>
    </li>
  );
}
