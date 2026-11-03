import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import {
  isUpcoming,
  SessionRow,
  useRealtimeEvent,
  type LearningRequest,
  type PublicTutor,
  type SessionSeat,
} from '@tutora/core';
import { publicApi } from '@tutora/core/catalog';
import { Alert, EmptyState, Loading, PageHeader, SectionHeader } from '@tutora/ui';
import { api, sessionApi } from '../api';

export const sessionsKey = ['student', 'sessions'] as const;

export function useSessions() {
  return useQuery({ queryKey: sessionsKey, queryFn: sessionApi.list });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () =>
      unwrap<LearningRequest>(api.GET('/student/requests/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
  });
}

export function useTutorName(userId: string | undefined) {
  return useQuery({
    queryKey: ['public', 'tutor', userId],
    queryFn: () =>
      unwrap<PublicTutor>(
        publicApi.GET('/public/tutors/{userId}', { params: { path: { userId: userId! } } }),
      ),
    enabled: !!userId,
    retry: false,
  });
}

function Row({ seat }: { seat: SessionSeat }) {
  const req = useRequest(seat.requestId);
  const tutor = useTutorName(seat.tutorUserId);
  return (
    <SessionRow
      seat={seat}
      title={req.data?.title ?? 'Session'}
      who={tutor.data?.fullName ?? 'Tutor'}
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
    if (/^(session|payment|booking)\./.test(n.type))
      void qc.invalidateQueries({ queryKey: sessionsKey });
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
      <PageHeader kicker="Learning" title="Sessions" />
      <section aria-labelledby="up" className="mb-12">
        <SectionHeader id="up" title="Coming up" />
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing booked">
            <Link to="/requests" className="link">
              Check your requests for bids
            </Link>
          </EmptyState>
        ) : (
          <ul>
            {upcoming.map((s) => (
              <Row key={s.participantId} seat={s} />
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past">
          <SectionHeader id="past" title="Past sessions" />
          <ul>
            {past.map((s) => (
              <Row key={s.participantId} seat={s} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
