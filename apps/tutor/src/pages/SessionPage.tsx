import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import {
  Attendance,
  describeAuthError,
  formatCountdown,
  formatDateTime,
  formatINR,
  PreJoin,
  ReplayView,
  sessionPhase,
  useNow,
  useRealtimeEvent,
  useRoom,
  useSession,
  type JoinToken,
  type Replay,
} from '@tutora/core';
import {
  Alert,
  Button,
  Card,
  Facts,
  Kicker,
  Loading,
  SectionHeader,
  StatusTag,
  Textarea,
} from '@tutora/ui';
import { lazy, Suspense, useState } from 'react';
import { api, sessionApi } from '../api';
import { sessionsKey, useSessionRequest, useSessions } from './SessionsPage';

const LiveRoom = lazy(() => import('@tutora/core/live'));

export function SessionPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const session = useSession();
  const me = session.status === 'signedIn' ? session.user.id : '';
  const sessions = useSessions();
  const seat = sessions.data?.find((s) => s.sessionId === id);
  const request = useSessionRequest(seat?.requestId);
  const now = useNow();
  const [token, setToken] = useState<JoinToken | null>(null);

  useRoom(seat && sessionPhase(seat) !== 'payment' ? `session:${id}` : null);
  useRealtimeEvent<{ sessionId?: string }>(
    ['session.status_changed', 'session.participant_joined', 'replay.ready'],
    (e) => {
      if (e.sessionId !== id) return;
      void qc.invalidateQueries({ queryKey: sessionsKey });
      void qc.invalidateQueries({ queryKey: ['session', id] });
    },
  );
  useRealtimeEvent<{ type: string; data: { sessionId?: string } }>('notification.created', (n) => {
    if (n.data.sessionId === id) void qc.invalidateQueries({ queryKey: sessionsKey });
  });

  if (sessions.isPending) return <Loading />;
  if (!seat) {
    return (
      <Alert tone="danger" title="Session not found">
        <Link to="/sessions" className="link">
          Back to sessions
        </Link>
      </Alert>
    );
  }
  const phase = sessionPhase(seat);
  const learner = request.data?.studentDisplayName ?? 'Learner';

  return (
    <article className="flex flex-col gap-10">
      <header className="border-b-4 border-text pb-6">
        <Link to="/sessions" className="link text-xs">
          ← Sessions
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Kicker>{request.data?.skill.name ?? 'Session'}</Kicker>
          <StatusTag status={seat.sessionStatus} />
        </div>
        <h1 className="mt-2 max-w-4xl text-4xl font-black leading-[1.05] md:text-5xl">
          {request.data?.title ?? 'Your session'}
        </h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted">
          with {learner} · {formatDateTime(seat.startsAt)} · {seat.durationMinutes} min ·{' '}
          {formatINR(seat.amountPaise)}
        </p>
      </header>

      {phase === 'payment' && (
        <Alert tone="warning" title="Waiting for the learner to pay">
          {seat.paymentDueAt && new Date(seat.paymentDueAt).getTime() > now
            ? `They have ${formatCountdown(new Date(seat.paymentDueAt).getTime() - now)} left. If they don't pay, the request reopens for bids.`
            : 'The payment window has closed.'}
        </Alert>
      )}

      {(phase === 'upcoming' || phase === 'live') &&
        (token ? (
          <Suspense fallback={<Loading label="Opening the room" />}>
            <LiveRoom
              sessionId={id}
              token={token}
              api={sessionApi}
              nameFor={(identity) => (identity.startsWith('student:') ? learner : 'Tutor')}
              onLeave={() => {
                setToken(null);
                void qc.invalidateQueries({ queryKey: sessionsKey });
              }}
            />
          </Suspense>
        ) : (
          <PreJoin seat={seat} api={sessionApi} me={me} onJoin={setToken} />
        ))}

      {phase === 'ended' && (
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <ReplayView api={sessionApi} sessionId={id} />
          <aside className="flex flex-col gap-8">
            <NotesEditor sessionId={id} />
            <Attendance api={sessionApi} sessionId={id} />
          </aside>
        </div>
      )}

      {phase === 'closed' && (
        <Card>
          <Facts
            items={[
              ['Status', seat.sessionStatus.toLowerCase().replace(/_/g, ' ')],
              ['Learner seat', seat.participantStatus.toLowerCase().replace(/_/g, ' ')],
            ]}
          />
        </Card>
      )}
    </article>
  );
}

/** Tutor's notes for the learner: replace any generated notes on the replay. */
function NotesEditor({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const replay = useQuery({
    queryKey: ['session', sessionId, 'replay'],
    queryFn: () => sessionApi.replay(sessionId),
  });
  const mine = replay.data?.notes?.source === 'TUTOR' ? replay.data.notes.content : null;
  const [summary, setSummary] = useState<string | null>(null);
  const [points, setPoints] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      unwrap<Replay>(
        api.PUT('/tutor/sessions/{id}/notes', {
          params: { path: { id: sessionId } },
          body: {
            summary: (summary ?? mine?.summary ?? '').trim(),
            keyPoints: (points ?? mine?.keyPoints.map((k) => k.text).join('\n') ?? '')
              .split('\n')
              .map((p) => p.trim())
              .filter(Boolean),
          },
        }),
      ),
    onSuccess: (r) => qc.setQueryData(['session', sessionId, 'replay'], r),
  });
  if (replay.isPending) return <Loading />;
  return (
    <section aria-labelledby="notes-editor">
      <SectionHeader id="notes-editor" title="Notes for your learner" />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {save.isSuccess && <Alert tone="success">Notes published to the replay.</Alert>}
        {save.error && <Alert tone="danger">{describeAuthError(save.error)}</Alert>}
        <Textarea
          label="Summary"
          rows={4}
          value={summary ?? mine?.summary ?? ''}
          onChange={(e) => setSummary(e.target.value)}
          hint="What you covered and what to practise next."
        />
        <Textarea
          label="Key points"
          rows={4}
          value={points ?? mine?.keyPoints.map((k) => k.text).join('\n') ?? ''}
          onChange={(e) => setPoints(e.target.value)}
          hint="One per line."
        />
        <div>
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!(summary ?? mine?.summary ?? '').trim()}
          >
            {mine ? 'Update notes' : 'Publish notes'}
          </Button>
        </div>
      </form>
    </section>
  );
}
