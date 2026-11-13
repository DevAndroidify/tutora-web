import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@tutora/api-client';
import { Alert, Button, Card, EmptyState, Field, Loading, SectionHeader, Tag } from '@tutora/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { describeAuthError } from './auth-ui';
import { formatDateTime, formatINR } from './format';
import type {
  AttendanceRow,
  JoinToken,
  LiveMode,
  Presign,
  RecordingView,
  Replay,
  ReplaySearch,
  SessionSeat,
  TranscriptSegment,
} from './types';

/** The per-app session endpoints (/student/sessions/... or /tutor/sessions/...). */
export interface SessionApi {
  list(): Promise<SessionSeat[]>;
  joinToken(sessionId: string): Promise<JoinToken>;
  consent(sessionId: string, granted: boolean): Promise<RecordingView>;
  recording(sessionId: string): Promise<RecordingView>;
  attendance(sessionId: string): Promise<AttendanceRow[]>;
  replay(sessionId: string): Promise<Replay>;
  search(sessionId: string, q: string): Promise<ReplaySearch>;
  modeEvent(
    sessionId: string,
    body: { mode: LiveMode; downlinkKbps?: number; reason?: string },
  ): Promise<unknown>;
  presignSnapshot(
    sessionId: string,
    body: { contentType: string; sizeBytes: number },
  ): Promise<Presign>;
  saveSnapshot(sessionId: string, body: { objectKey: string; isFinal?: boolean }): Promise<unknown>;
}

/** Minutes before the start when the room opens (the backend's join window). */
export const ROOM_OPENS_MINUTES = 15;

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** "2d 4h", "14:05" or "0:42" until a time. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export type SessionPhase = 'payment' | 'upcoming' | 'live' | 'ended' | 'closed';

export function sessionPhase(seat: Pick<SessionSeat, 'sessionStatus'>): SessionPhase {
  switch (seat.sessionStatus) {
    case 'PENDING_PAYMENT':
      return 'payment';
    case 'SCHEDULED':
      return 'upcoming';
    case 'LIVE':
      return 'live';
    case 'ENDED':
    case 'COMPLETED':
      return 'ended';
    default:
      return 'closed';
  }
}

export const isUpcoming = (s: SessionSeat) =>
  ['payment', 'upcoming', 'live'].includes(sessionPhase(s));

/** Big serif date block used in session lists ("03 / NOV"). */
export function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span
      className="flex w-16 shrink-0 flex-col items-center rounded-[12px] border-2 border-ink bg-brand py-1.5 text-[#16161a]"
      aria-hidden
    >
      <span className="font-display text-3xl font-extrabold leading-none">
        {String(d.getDate()).padStart(2, '0')}
      </span>
      <span className="text-xs font-extrabold">
        {d.toLocaleDateString('en-IN', { month: 'short' })}
      </span>
    </span>
  );
}

/** One row in a sessions list. */
export function SessionRow({
  seat,
  title,
  who,
  link,
}: {
  seat: SessionSeat;
  title: string;
  who: string;
  link: (children: ReactNode) => ReactNode;
}) {
  const phase = sessionPhase(seat);
  return (
    <li className="rounded-[var(--radius-card)] border-2 border-ink bg-surface px-4">
      {link(
        <div className="story flex items-center gap-5 py-5">
          <DateBlock iso={seat.startsAt} />
          <div className="min-w-0 flex-1">
            <h3 className="story-title truncate text-xl font-extrabold">{title}</h3>
            <p className="mt-1 text-xs font-semibold text-muted">
              {formatDateTime(seat.startsAt)} · {seat.durationMinutes} min · {who} ·{' '}
              {formatINR(seat.amountPaise)}
            </p>
          </div>
          <Tag
            tone={
              phase === 'live'
                ? 'danger'
                : phase === 'payment'
                  ? 'warning'
                  : phase === 'upcoming'
                    ? 'brand'
                    : 'neutral'
            }
          >
            {phase === 'payment'
              ? 'Awaiting payment'
              : phase === 'upcoming'
                ? 'Scheduled'
                : phase === 'live'
                  ? 'Live now'
                  : phase === 'ended'
                    ? 'Ended'
                    : seat.sessionStatus.toLowerCase().replace(/_/g, ' ')}
          </Tag>
        </div>,
      )}
    </li>
  );
}

/** Recording consent plus the "room opens in…" gate and the join button. */
export function PreJoin({
  seat,
  api,
  me,
  onJoin,
}: {
  seat: SessionSeat;
  api: SessionApi;
  me: string;
  onJoin: (token: JoinToken) => void;
}) {
  const now = useNow();
  const qc = useQueryClient();
  const recording = useQuery({
    queryKey: ['session', seat.sessionId, 'recording'],
    queryFn: () => api.recording(seat.sessionId),
  });
  const consent = useMutation({
    mutationFn: (granted: boolean) => api.consent(seat.sessionId, granted),
    onSuccess: (r) => qc.setQueryData(['session', seat.sessionId, 'recording'], r),
  });
  const join = useMutation({ mutationFn: () => api.joinToken(seat.sessionId), onSuccess: onJoin });
  const opensAt = new Date(seat.startsAt).getTime() - ROOM_OPENS_MINUTES * 60_000;
  const open = now >= opensAt;
  const mine = recording.data?.consents.find((c) => c.userId === me);
  const everyone = recording.data?.consents ?? [];
  const allYes = everyone.length > 0 && everyone.every((c) => c.granted === true);
  const joinError =
    join.error instanceof ApiError && join.error.code === 'OUTSIDE_SESSION_WINDOW'
      ? `The room opens at ${formatDateTime(String(join.error.details.opensAt ?? ''))}.`
      : join.error
        ? describeAuthError(join.error)
        : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <section className="lift-lg flex flex-col items-start justify-center gap-4 rounded-[var(--radius-card)] border-2 border-ink bg-surface p-8">
        <p className="mark text-sm font-bold">
          {seat.sessionStatus === 'LIVE' ? 'Live now' : open ? 'Room is open' : 'Room opens in'}
        </p>
        <p className="font-display text-6xl font-extrabold leading-none md:text-7xl">
          {seat.sessionStatus === 'LIVE' || open
            ? 'Join the session'
            : formatCountdown(opensAt - now)}
        </p>
        <p className="text-[15px] text-muted">
          Starts {formatDateTime(seat.startsAt)} · {seat.durationMinutes} minutes. Use headphones;
          on a weak connection switch to audio only.
        </p>
        <Button
          className="mt-2 px-8 py-4"
          disabled={!open && seat.sessionStatus !== 'LIVE'}
          loading={join.isPending}
          onClick={() => join.mutate()}
        >
          Join now
        </Button>
        {joinError && <p className="text-sm font-bold text-danger">{joinError}</p>}
      </section>
      <Card>
        <h3 className="text-xl font-extrabold">Recording</h3>
        <p className="mt-2 text-sm text-muted">
          A session is recorded only if everyone agrees. Recordings power your replay, transcript
          search and notes.
        </p>
        {recording.isPending ? (
          <Loading />
        ) : (
          <>
            <div className="mt-4 flex gap-2" role="group" aria-label="Your recording consent">
              <Button
                variant={mine?.granted === true ? 'primary' : 'secondary'}
                loading={consent.isPending && consent.variables === true}
                onClick={() => consent.mutate(true)}
              >
                I agree
              </Button>
              <Button
                variant={mine?.granted === false ? 'primary' : 'secondary'}
                loading={consent.isPending && consent.variables === false}
                onClick={() => consent.mutate(false)}
              >
                Don&apos;t record
              </Button>
            </div>
            <ul className="mt-4 flex flex-col gap-1 text-sm">
              {everyone.map((c) => (
                <li key={c.userId} className="flex justify-between border-b border-border py-1.5">
                  <span>{c.userId === me ? 'You' : c.role === 'TUTOR' ? 'Tutor' : 'Learner'}</span>
                  <span className="font-semibold">
                    {c.granted === null ? 'Not answered' : c.granted ? 'Agreed' : 'Declined'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-bold text-muted">
              {allYes ? 'This session will be recorded' : 'Not recorded unless everyone agrees'}
            </p>
          </>
        )}
        {consent.error && <Alert tone="danger">{describeAuthError(consent.error)}</Alert>}
      </Card>
    </div>
  );
}

export function Attendance({
  api,
  sessionId,
}: {
  api: Pick<SessionApi, 'attendance'>;
  sessionId: string;
}) {
  const rows = useQuery({
    queryKey: ['session', sessionId, 'attendance'],
    queryFn: () => api.attendance(sessionId),
  });
  if (!rows.data?.length) return null;
  return (
    <section aria-labelledby="attendance">
      <SectionHeader id="attendance" title="Attendance" />
      <ul className="flex flex-col">
        {rows.data.map((r) => (
          <li key={r.identity} className="flex justify-between border-b border-border py-2 text-sm">
            <span className="font-semibold">{r.role === 'TUTOR' ? 'Tutor' : 'Learner'}</span>
            <span className="text-muted">
              joined {formatDateTime(r.firstJoinedAt)} · {Math.round(r.seconds / 60)} min
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Renders "[[match]]" markers from transcript search as <mark>. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[\[.*?\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[[') ? (
          <mark key={i} className="bg-brand px-0.5 text-black">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Replay: recording, tutor notes, flashcards, whiteboard snapshots and searchable transcript. */
export function ReplayView({ api, sessionId }: { api: SessionApi; sessionId: string }) {
  const replay = useQuery({
    queryKey: ['session', sessionId, 'replay'],
    queryFn: () => api.replay(sessionId),
  });
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const search = useQuery({
    queryKey: ['session', sessionId, 'search', query],
    queryFn: () => api.search(sessionId, query),
    enabled: query.length >= 2,
  });
  const video = useRef<HTMLVideoElement>(null);
  const seek = (ms: number) => {
    const el = video.current;
    if (el) {
      el.currentTime = ms / 1000;
      void el.play().catch(() => undefined);
    }
  };
  if (replay.isPending) return <Loading />;
  if (replay.isError) return <Alert tone="danger">{replay.error.message}</Alert>;
  const r = replay.data;
  const segments: Array<TranscriptSegment & { snippet?: string }> =
    query.length >= 2 ? (search.data?.results ?? []) : r.transcript.segments;
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="recording">
        <SectionHeader id="recording" title="Replay" />
        {r.recording.url ? (
          <video
            ref={video}
            src={r.recording.url}
            controls
            className="aspect-video w-full bg-black"
          />
        ) : (
          <EmptyState
            title={
              r.recording.status === 'NOT_RECORDED'
                ? 'Not recorded'
                : r.recording.status === 'FAILED'
                  ? 'Recording unavailable'
                  : 'Recording is processing'
            }
          >
            {r.recording.status === 'NOT_RECORDED'
              ? 'Someone declined recording, so there is no video. Notes and quizzes still work.'
              : r.recording.status === 'FAILED'
                ? 'The recorder could not save this session.'
                : 'Check back in a few minutes.'}
          </EmptyState>
        )}
        {r.recording.deleteAfter && (
          <p className="mt-2 text-xs text-muted">
            Kept until {formatDateTime(r.recording.deleteAfter)}.
          </p>
        )}
      </section>

      {r.notes && (
        <section aria-labelledby="notes">
          <SectionHeader
            id="notes"
            title={r.notes.source === 'TUTOR' ? "Tutor's notes" : 'Session notes (generated)'}
          />
          <p className="font-display text-xl leading-relaxed">{r.notes.content.summary}</p>
          {r.notes.content.keyPoints.length > 0 && (
            <ol className="mt-4 flex flex-col gap-2">
              {r.notes.content.keyPoints.map((k, i) => (
                <li
                  key={i}
                  className="flex gap-3 border-l-4 border-brand bg-surface px-4 py-2 text-sm"
                >
                  <span className="font-display text-lg font-extrabold">{i + 1}</span>
                  <span className="flex-1">{k.text}</span>
                  {k.atMs > 0 && r.recording.url && (
                    <button type="button" className="link text-xs" onClick={() => seek(k.atMs)}>
                      {mmss(k.atMs)}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {r.flashcards && r.flashcards.content.cards.length > 0 && (
        <section aria-labelledby="cards">
          <SectionHeader id="cards" title="Flashcards" />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {r.flashcards.content.cards.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={flipped.has(i)}
                  onClick={() =>
                    setFlipped((f) => new Set(f.has(i) ? [...f].filter((x) => x !== i) : [...f, i]))
                  }
                  className="flex min-h-36 w-full flex-col justify-center rounded-[var(--radius-card)] border-2 border-ink bg-surface p-5 text-left hover:bg-sunken"
                >
                  <span className="text-xs font-extrabold text-muted">
                    {flipped.has(i) ? 'Answer' : 'Question'}
                  </span>
                  <span className="mt-2 font-display text-lg font-bold">
                    {flipped.has(i) ? c.back : c.front}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.whiteboard.length > 0 && (
        <section aria-labelledby="board">
          <SectionHeader id="board" title="Whiteboard" />
          <div className="grid gap-4 sm:grid-cols-2">
            {r.whiteboard.map((w, i) =>
              w.url ? (
                <img
                  key={w.id ?? i}
                  src={w.url}
                  alt={`Whiteboard snapshot ${i + 1}`}
                  className="w-full border border-border bg-white"
                />
              ) : null,
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="transcript">
        <SectionHeader id="transcript" title="Transcript" />
        {r.transcript.status !== 'READY' && r.transcript.segments.length === 0 ? (
          <p className="text-sm text-muted">
            {r.transcript.status === 'NOT_RECORDED'
              ? 'No transcript without a recording.'
              : 'The transcript appears here once the recording is processed.'}
          </p>
        ) : (
          <>
            <form
              role="search"
              className="mb-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(q.trim());
              }}
            >
              <Field
                label="Search this session"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="secondary" className="self-end">
                Search
              </Button>
            </form>
            {query && (
              <p className="mb-2 text-xs font-bold text-muted">
                {segments.length} matches for “{query}”
              </p>
            )}
            <ol className="flex max-h-[28rem] flex-col overflow-y-auto">
              {segments.map((s, i) => (
                <li
                  key={`${s.startMs}-${i}`}
                  className="flex gap-4 border-b border-border py-2 text-sm"
                >
                  <button
                    type="button"
                    className="w-12 shrink-0 text-left font-mono text-xs text-muted hover:text-text"
                    onClick={() => seek(s.startMs)}
                  >
                    {mmss(s.startMs)}
                  </button>
                  {s.speaker && <span className="w-20 shrink-0 font-bold">{s.speaker}</span>}
                  <span>{s.snippet ? <Highlighted text={s.snippet} /> : s.text}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
