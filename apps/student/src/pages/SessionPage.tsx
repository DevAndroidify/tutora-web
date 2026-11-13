import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError, unwrap } from '@tutora/api-client';
import {
  Attendance,
  describeAuthError,
  DISPUTE_REASONS,
  formatDateTime,
  formatINR,
  PreJoin,
  ReplayView,
  sessionPhase,
  useRealtimeEvent,
  useRoom,
  useSession,
  type Dispute,
  type DisputeReason,
  type JoinToken,
  type Quiz,
} from '@tutora/core';
import {
  Alert,
  Button,
  Card,
  Facts,
  Kicker,
  Loading,
  SectionHeader,
  Select,
  StatusTag,
  Textarea,
} from '@tutora/ui';
import { lazy, Suspense, useState } from 'react';
import { api, sessionApi } from '../api';
import { Checkout } from './Checkout';
import { sessionsKey, useRequest, useSessions, useTutorName } from './SessionsPage';

const LiveRoom = lazy(() => import('@tutora/core/live'));

export function SessionPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const session = useSession();
  const me = session.status === 'signedIn' ? session.user.id : '';
  const sessions = useSessions();
  const seat = sessions.data?.find((s) => s.sessionId === id);
  const request = useRequest(seat?.requestId);
  const tutor = useTutorName(seat?.tutorUserId);
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
  useRealtimeEvent<{ data: { sessionId?: string } }>('notification.created', (n) => {
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
  const tutorName = tutor.data?.fullName ?? 'Your tutor';

  return (
    <article className="flex flex-col gap-10">
      <header>
        <Link to="/sessions" className="link text-xs">
          ← Sessions
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Kicker>{request.data?.skill.name ?? 'Session'}</Kicker>
          <StatusTag status={seat.sessionStatus} />
        </div>
        <h1 className="mt-2 max-w-4xl text-4xl font-extrabold leading-[1.05] md:text-5xl">
          {request.data?.title ?? 'Your session'}
        </h1>
        <p className="mt-3 text-sm font-semibold text-muted">
          with{' '}
          <Link to="/tutors/$userId" params={{ userId: seat.tutorUserId }} className="link">
            {tutorName}
          </Link>{' '}
          · {formatDateTime(seat.startsAt)} · {seat.durationMinutes} min ·{' '}
          {formatINR(seat.amountPaise)}
        </p>
      </header>

      {phase === 'payment' && <Checkout seat={seat} />}

      {(phase === 'upcoming' || phase === 'live') &&
        (token ? (
          <Suspense fallback={<Loading label="Opening the room" />}>
            <LiveRoom
              sessionId={id}
              token={token}
              api={sessionApi}
              nameFor={(identity) => (identity.startsWith('tutor:') ? tutorName : 'Learner')}
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
          <aside className="flex flex-col gap-10">
            <QuizPanel sessionId={id} />
            <ReviewPanel sessionId={id} tutorName={tutorName} />
            <DisputePanel sessionId={id} />
            <Attendance api={sessionApi} sessionId={id} />
          </aside>
        </div>
      )}

      {phase === 'closed' && (
        <Card>
          <Facts
            items={[
              ['Session', seat.sessionStatus.toLowerCase().replace(/_/g, ' ')],
              ['Your seat', seat.participantStatus.toLowerCase().replace(/_/g, ' ')],
            ]}
          />
        </Card>
      )}
    </article>
  );
}

function QuizPanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const quizzes = useQuery({
    queryKey: ['student', 'quizzes'],
    queryFn: () => unwrap<Quiz[]>(api.GET('/student/quizzes')),
  });
  const quiz = quizzes.data?.find((q) => q.sessionId === sessionId);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const submit = useMutation({
    mutationFn: (q: Quiz) =>
      unwrap<Quiz>(
        api.POST('/student/quizzes/{id}/submit', {
          params: { path: { id: q.id } },
          body: { answers: q.questions.map((x) => answers[x.id] ?? -1) },
        }),
      ),
    onSuccess: (q) =>
      qc.setQueryData<Quiz[]>(['student', 'quizzes'], (all) =>
        all?.map((x) => (x.id === q.id ? q : x)),
      ),
  });
  if (!quiz) return null;
  return (
    <section aria-labelledby="quiz">
      <SectionHeader id="quiz" title="Exit quiz" />
      {quiz.result ? (
        <div className="border-l-8 border-brand bg-surface p-5">
          <p className="font-display text-5xl font-extrabold">
            {quiz.result.correct}/{quiz.result.total}
          </p>
          <p className="mt-1 text-sm font-bold">
            {quiz.result.passed ? 'Passed' : 'Keep practising'}
          </p>
          <p className="mt-2 text-xs text-muted">
            Results feed your tutor's teaching-outcome score, anonymously.
          </p>
        </div>
      ) : (
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate(quiz);
          }}
        >
          <p className="text-sm text-muted">
            Five quick questions. Due {formatDateTime(quiz.dueAt)}.
          </p>
          {quiz.questions.map((q, i) => (
            <fieldset key={q.id} className="flex flex-col gap-2">
              <legend className="mb-2 font-semibold">
                {i + 1}. {q.prompt}
              </legend>
              {q.options.map((o, j) => (
                <label
                  key={j}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border-2 border-ink bg-surface px-3.5 py-2 text-[15px] has-[:checked]:bg-brand has-[:checked]:text-[#16161a]"
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === j}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: j }))}
                  />
                  {o}
                </label>
              ))}
            </fieldset>
          ))}
          {submit.error && <Alert tone="danger">{describeAuthError(submit.error)}</Alert>}
          <Button
            type="submit"
            loading={submit.isPending}
            disabled={quiz.questions.some((q) => answers[q.id] === undefined)}
          >
            Submit answers
          </Button>
        </form>
      )}
    </section>
  );
}

function ReviewPanel({ sessionId, tutorName }: { sessionId: string; tutorName: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const review = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/student/sessions/{id}/review', {
          params: { path: { id: sessionId } },
          body: { rating, comment: comment.trim() || undefined },
        }),
      ),
  });
  const already = review.error instanceof ApiError && review.error.status === 409;
  return (
    <section aria-labelledby="review">
      <SectionHeader id="review" title={`Rate ${tutorName}`} />
      {review.isSuccess || already ? (
        <Alert tone="success">
          {already
            ? 'You already reviewed this session.'
            : 'Thanks, your review is on their profile.'}
        </Alert>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            review.mutate();
          }}
        >
          <div role="radiogroup" aria-label="Rating" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                onClick={() => setRating(n)}
                className={`size-12 rounded-[12px] border-2 border-ink font-display text-2xl font-extrabold ${n <= rating ? 'bg-brand text-[#16161a]' : 'bg-surface text-muted'}`}
              >
                ★
              </button>
            ))}
          </div>
          <Textarea
            label="Comment (optional)"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {review.error && !already && (
            <Alert tone="danger">{describeAuthError(review.error)}</Alert>
          )}
          <div>
            <Button type="submit" disabled={!rating} loading={review.isPending}>
              Post review
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function DisputePanel({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DisputeReason>('TECHNICAL_ISSUES');
  const [details, setDetails] = useState('');
  const dispute = useMutation({
    mutationFn: () =>
      unwrap<Dispute>(
        api.POST('/student/sessions/{id}/disputes', {
          params: { path: { id: sessionId } },
          body: { reason, details: details.trim() || undefined },
        }),
      ),
  });
  if (dispute.isSuccess) {
    return (
      <Alert tone="info" title="Dispute opened">
        Your payment stays held until our team decides. We'll notify you.
      </Alert>
    );
  }
  return (
    <section aria-labelledby="dispute">
      <SectionHeader id="dispute" title="Something went wrong?" />
      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open a dispute
        </Button>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            dispute.mutate();
          }}
        >
          <Select
            label="What happened?"
            value={reason}
            onChange={(e) => setReason(e.target.value as DisputeReason)}
          >
            {Object.entries(DISPUTE_REASONS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Textarea
            label="Details"
            rows={3}
            maxLength={2000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          {dispute.error && <Alert tone="danger">{describeAuthError(dispute.error)}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={dispute.isPending}>
              Send to Tutora
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
