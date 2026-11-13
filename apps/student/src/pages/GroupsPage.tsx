import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ApiError, unwrap } from '@tutora/api-client';
import {
  describeAuthError,
  formatDateTime,
  formatINR,
  humanize,
  timeFromNow,
  useRealtimeEvent,
  type PoolBid,
  type PoolInvite,
  type PoolOffers,
  type PoolSeat,
} from '@tutora/core';
import {
  Alert,
  Button,
  EmptyState,
  Kicker,
  Loading,
  Modal,
  PageHeader,
  SectionHeader,
  StatusTag,
} from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';
import { BidCard } from './BidsSection';
import { sessionsKey, useSessions } from './SessionsPage';

export const invitesKey = ['student', 'pools', 'invites'] as const;
const offersKey = (poolId: string) => ['student', 'pools', poolId, 'offers'] as const;

const seatsLabel = (b: PoolBid) =>
  b.minSeats && b.maxSeats ? `${b.minSeats}–${b.maxSeats} learners` : 'group';

export function GroupsPage() {
  const qc = useQueryClient();
  const invites = useQuery({
    queryKey: invitesKey,
    queryFn: () => unwrap<PoolInvite[]>(api.GET('/student/pools/invites')),
  });
  // Invitations, new group offers, confirmations and expiries all arrive as notifications.
  useRealtimeEvent<{ type: string }>('notification.created', (n) => {
    if (n.type.startsWith('pool.') || n.type.startsWith('bid.'))
      void qc.invalidateQueries({ queryKey: ['student', 'pools'] });
  });
  const list = invites.data ?? [];
  const pending = list.filter((i) => i.status === 'INVITED');
  const joined = list.filter((i) => i.status === 'ACCEPTED');
  return (
    <>
      <PageHeader
        kicker="Group sessions"
        title="Learn together, pay less"
        description="When other learners ask for nearly the same thing, we invite you to a group. Tutors bid a price per seat, and nobody sees who else is in it."
      />
      {invites.isPending ? (
        <Loading />
      ) : invites.isError ? (
        <Alert tone="danger">{invites.error.message}</Alert>
      ) : list.length === 0 ? (
        <EmptyState title="No group invitations">
          Post a request and we&apos;ll invite you if others want the same.{' '}
          <Link to="/requests/new" className="link">
            New request
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-12">
          {pending.length > 0 && (
            <section aria-labelledby="invited">
              <SectionHeader id="invited" title={`Invitations · ${pending.length}`} />
              <ul className="flex flex-col gap-6">
                {pending.map((i) => (
                  <InviteCard key={i.id} invite={i} />
                ))}
              </ul>
            </section>
          )}
          {joined.map((i) => (
            <GroupOffers key={i.id} invite={i} />
          ))}
        </div>
      )}
    </>
  );
}

function PoolHeadline({ invite: i }: { invite: PoolInvite }) {
  return (
    <>
      <Kicker className="mb-1">
        {i.pool.skill.name} · {humanize(i.pool.level)}
      </Kicker>
      <p className="text-xs font-semibold text-muted">
        {i.pool.joined} joined · {i.pool.invited} invited · up to {i.pool.seatCap} seats
      </p>
    </>
  );
}

function InviteCard({ invite: i }: { invite: PoolInvite }) {
  const qc = useQueryClient();
  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      unwrap<unknown>(
        accept
          ? api.POST('/student/pools/invites/{id}/accept', { params: { path: { id: i.id } } })
          : api.POST('/student/pools/invites/{id}/decline', { params: { path: { id: i.id } } }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student', 'pools'] });
      void qc.invalidateQueries({ queryKey: ['request', i.requestId] });
      void qc.invalidateQueries({ queryKey: ['requests'] });
    },
  });
  return (
    <li className="grid gap-4 border-t-8 border-brand bg-surface p-6 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <PoolHeadline invite={i} />
        <h3 className="mt-2 text-2xl font-extrabold leading-tight">
          Join a group for{' '}
          <Link to="/requests/$id" params={{ id: i.requestId }} className="underline">
            your request
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">
          Your request stops taking individual bids while you&apos;re in the group. Invitation
          expires {timeFromNow(i.expiresAt)}.
        </p>
        {respond.error && (
          <div className="mt-3">
            <Alert tone="danger">{describeAuthError(respond.error)}</Alert>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          loading={respond.isPending && respond.variables === true}
          onClick={() => respond.mutate(true)}
        >
          Join group
        </Button>
        <Button
          variant="ghost"
          loading={respond.isPending && respond.variables === false}
          onClick={() => respond.mutate(false)}
        >
          No thanks
        </Button>
      </div>
    </li>
  );
}

function GroupOffers({ invite }: { invite: PoolInvite }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const poolId = invite.pool.id;
  const [choosing, setChoosing] = useState<PoolBid | null>(null);
  const offers = useQuery({
    queryKey: offersKey(poolId),
    queryFn: () =>
      unwrap<PoolOffers>(api.GET('/student/pools/{id}/bids', { params: { path: { id: poolId } } })),
  });
  const sessions = useSessions();
  const mySeat = sessions.data?.find((s) => s.requestId === invite.requestId);
  const accept = useMutation({
    mutationFn: (bidId: string) =>
      unwrap<PoolSeat>(
        api.POST('/student/pools/{id}/bids/{bidId}/accept', {
          params: { path: { id: poolId, bidId } },
        }),
      ),
    onSuccess: async (seat) => {
      await qc.invalidateQueries({ queryKey: sessionsKey });
      await qc.invalidateQueries({ queryKey: ['student', 'pools'] });
      await navigate({ to: '/sessions/$id', params: { id: seat.sessionId } });
    },
  });
  const status = offers.data?.status ?? invite.pool.status;
  const chosen = offers.data?.acceptedBidId ?? null;
  const shown = (offers.data?.bids ?? []).filter((b) => !chosen || b.id === chosen);
  const otherChosen =
    accept.error instanceof ApiError && accept.error.code === 'OTHER_OFFER_CHOSEN';

  return (
    <section aria-labelledby={`g-${poolId}`}>
      <SectionHeader
        id={`g-${poolId}`}
        title={`Your ${invite.pool.skill.name} group`}
        action={<StatusTag status={status} />}
      />
      <div className="mb-5">
        <PoolHeadline invite={invite} />
      </div>
      {mySeat ? (
        <Alert
          tone="success"
          title={
            mySeat.sessionStatus === 'PENDING_PAYMENT' ? 'Seat held: pay to confirm' : 'Seat booked'
          }
        >
          <Link to="/sessions/$id" params={{ id: mySeat.sessionId }} className="link">
            {mySeat.sessionStatus === 'PENDING_PAYMENT' ? 'Pay for your seat' : 'Open your session'}
          </Link>
        </Alert>
      ) : status === 'AWAITING_PAYMENTS' && chosen ? (
        <div className="mb-5">
          <Alert tone="warning" title="Your group chose an offer">
            Take a seat and pay before the deadline. The session runs only if enough learners pay;
            otherwise everyone is refunded automatically.
          </Alert>
        </div>
      ) : null}
      {offers.isPending ? (
        <Loading />
      ) : offers.isError ? (
        <Alert tone="danger">{offers.error.message}</Alert>
      ) : shown.length === 0 ? (
        <EmptyState title="No offers yet">
          Verified tutors can see this group now. Offers appear here.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-6">
          {shown.map((b, n) => (
            <BidCard
              key={b.id}
              bid={b}
              rank={chosen ? null : n + 1}
              seats={seatsLabel(b)}
              canAccept={
                !mySeat &&
                (status === 'FORMING' ||
                  status === 'BIDDING' ||
                  (status === 'AWAITING_PAYMENTS' && b.id === chosen))
              }
              acceptLabel={chosen ? 'Take my seat' : 'Accept for the group'}
              onAccept={() => setChoosing(b)}
            />
          ))}
        </ol>
      )}
      <Modal
        open={!!choosing}
        title={chosen ? 'Take your seat?' : 'Accept this offer for the group?'}
        onClose={() => {
          setChoosing(null);
          accept.reset();
        }}
      >
        {choosing && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              <strong>{choosing.tutor.fullName}</strong> · {formatINR(choosing.seatPricePaise)} per
              seat · {formatDateTime(choosing.proposedStartAt)}, {choosing.durationMinutes} min ·{' '}
              {seatsLabel(choosing)}.
            </p>
            <p className="text-sm text-muted">
              {chosen
                ? 'You pay for your own seat. Tutora holds the money until after the session.'
                : 'This fixes the offer for everyone in the group and starts the payment deadline. Each learner pays for their own seat; if too few pay in time, everyone is refunded.'}
            </p>
            {accept.error && (
              <Alert tone="danger">
                {otherChosen
                  ? 'Someone in your group just chose a different offer. Refresh to see it.'
                  : describeAuthError(accept.error)}
              </Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setChoosing(null)}>
                Not yet
              </Button>
              <Button loading={accept.isPending} onClick={() => accept.mutate(choosing.id)}>
                {chosen ? 'Take my seat and pay' : 'Accept and pay'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
