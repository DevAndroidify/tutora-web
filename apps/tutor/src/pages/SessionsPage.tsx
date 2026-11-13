import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import {
  isUpcoming,
  SessionRow,
  useRealtimeEvent,
  type MarketRequest,
  type SessionSeat,
} from '@tutora/core';
import { Alert, EmptyState, Loading, PageHeader, SectionHeader } from '@tutora/ui';
import { api, sessionApi } from '../api';

export const sessionsKey = ['tutor', 'sessions'] as const;

export function useSessions() {
  return useQuery({ queryKey: sessionsKey, queryFn: sessionApi.list });
}

/** The request behind a session, for its title and the learner's display name. */
export function useSessionRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['tutor', 'market', 'one', requestId],
    queryFn: () =>
      unwrap<MarketRequest>(
        api.GET('/tutor/requests/{id}', { params: { path: { id: requestId! } } }),
      ),
    enabled: !!requestId,
    retry: false,
  });
}

function Row({ seat }: { seat: SessionSeat }) {
  const req = useSessionRequest(seat.requestId);
  return (
    <SessionRow
      seat={seat}
      title={req.data?.title ?? 'Session'}
      who={req.data?.studentDisplayName ?? 'Learner'}
      link={(children) => (
        <Link to="/sessions/$id" params={{ id: seat.sessionId }}>
          {children}
        </Link>
      )}
    />
  );
}

export function SessionsPage() {
  const qc = useQueryClient();
  const sessions = useSessions();
  useRealtimeEvent<{ type: string }>('notification.created', (n) => {
    if (
      n.type.startsWith('session.') ||
      n.type.startsWith('bid.') ||
      n.type.startsWith('payment.')
    ) {
      void qc.invalidateQueries({ queryKey: sessionsKey });
    }
  });
  if (sessions.isPending) return <Loading />;
  if (sessions.isError) return <Alert tone="danger">{sessions.error.message}</Alert>;
  const upcoming = sessions.data
    .filter(isUpcoming)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = sessions.data
    .filter((s) => !isUpcoming(s))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return (
    <>
      <PageHeader kicker="Teaching" title="Sessions" />
      <section aria-labelledby="up" className="mb-12">
        <SectionHeader id="up" title="Coming up" />
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing scheduled">
            <Link to="/requests" className="link">
              Find learners in the marketplace
            </Link>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((s) => (
              <Row key={s.participantId} seat={s} />
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past">
          <SectionHeader id="past" title="Past" />
          <ul className="flex flex-col gap-3">
            {past.map((s) => (
              <Row key={s.participantId} seat={s} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
