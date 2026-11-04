import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError, unwrap } from '@tutora/api-client';
import {
  describeAuthError,
  formatDateTime,
  formatINR,
  humanize,
  rupeesToPaise,
  timeFromNow,
  useRealtimeEvent,
  useRoom,
  type Bid,
  type MarketRequest,
} from '@tutora/core';
import {
  Alert,
  Button,
  Card,
  Facts,
  Field,
  Kicker,
  Loading,
  SectionHeader,
  Select,
  StatusTag,
  Textarea,
} from '@tutora/ui';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { marketKey } from './MarketplacePage';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const MIN_LEAD_MS = 15 * 60_000;
const MAX_LEAD_MS = 30 * 86_400_000;

/** <input type="datetime-local"> value for a Date, in local time. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Default start: tomorrow, next full hour. */
const defaultStart = () => {
  const d = new Date(Date.now() + 86_400_000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
};

export function MarketRequestPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const key = [...marketKey, 'one', id];
  const request = useQuery({
    queryKey: key,
    queryFn: () =>
      unwrap<MarketRequest>(api.GET('/tutor/requests/{id}', { params: { path: { id } } })),
  });
  const [editing, setEditing] = useState(false);
  useRoom(request.data?.status === 'OPEN' ? `request:${id}:tutors` : null);
  useRealtimeEvent<{ requestId: string; bidCount: number }>('request.bid_count_changed', (e) => {
    if (e.requestId === id)
      qc.setQueryData<MarketRequest>(key, (r) => (r ? { ...r, bidCount: e.bidCount } : r));
  });
  useRealtimeEvent<{ requestId: string }>(
    ['request.closed', 'request.reopened', 'bid.accepted'],
    (e) => {
      if (e.requestId === id) void qc.invalidateQueries({ queryKey: key });
    },
  );
  const withdraw = useMutation({
    mutationFn: (bidId: string) =>
      unwrap<Bid>(api.POST('/tutor/bids/{id}/withdraw', { params: { path: { id: bidId } } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketKey });
      void qc.invalidateQueries({ queryKey: ['tutor', 'bids'] });
    },
  });

  if (request.isPending) return <Loading />;
  if (request.isError) {
    return (
      <Alert tone="danger" title="Can't open this request">
        {describeAuthError(request.error)}{' '}
        <Link to="/requests" className="link">
          Back to open requests
        </Link>
      </Alert>
    );
  }
  const r = request.data;
  const bid = r.myBid && r.myBid.status !== 'WITHDRAWN' ? r.myBid : null;
  const open = r.status === 'OPEN';

  return (
    <article className="flex flex-col gap-10">
      <header className="border-b-4 border-text pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Kicker>
            {r.skill.name} · {humanize(r.level)}
          </Kicker>
          <StatusTag status={r.status} />
        </div>
        <h1 className="max-w-4xl text-4xl font-black leading-[1.05] md:text-5xl">{r.title}</h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted">
          {r.studentDisplayName} · {r.bidCount} {r.bidCount === 1 ? 'bid' : 'bids'} so far
          {open && r.expiresAt ? ` · closes ${timeFromNow(r.expiresAt)}` : ''}
        </p>
      </header>
      <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-8">
          {r.skill.learnerNotice && (
            <Alert tone="warning" title="Rules for this skill">
              {r.skill.learnerNotice}
            </Alert>
          )}
          <section aria-labelledby="brief">
            <SectionHeader id="brief" title="The brief" />
            <p className="whitespace-pre-line font-display text-lg leading-relaxed">
              {r.description}
            </p>
          </section>
          {r.attachments.length > 0 && (
            <section aria-labelledby="files">
              <SectionHeader id="files" title="Attachments" />
              <ul className="flex flex-col gap-1">
                {r.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link text-sm"
                    >
                      {a.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Card>
            <Facts
              items={[
                ['Budget hint', formatINR(r.budgetHintPaise)],
                ['Language', r.preferredLanguage ?? 'Any'],
                ['Posted', formatDateTime(r.publishedAt)],
              ]}
            />
          </Card>
        </div>
        <aside>
          <SectionHeader id="bid" title={bid ? 'Your sealed bid' : 'Place a sealed bid'} />
          {bid && !editing ? (
            <Card className="border-t-8 border-t-brand">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-5xl font-black">{formatINR(bid.seatPricePaise)}</p>
                <StatusTag status={bid.status} />
              </div>
              <p className="mt-2 text-sm font-semibold">
                {formatDateTime(bid.proposedStartAt)} · {bid.durationMinutes} min
              </p>
              {bid.approachText && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
                  {bid.approachText}
                </p>
              )}
              {bid.status === 'SUBMITTED' && open && (
                <div className="mt-5 flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    Edit bid
                  </Button>
                  <Button
                    variant="ghost"
                    loading={withdraw.isPending}
                    onClick={() => {
                      if (window.confirm('Withdraw your bid? The learner will no longer see it.'))
                        withdraw.mutate(bid.id);
                    }}
                  >
                    Withdraw
                  </Button>
                </div>
              )}
              {bid.status === 'ACCEPTED' && (
                <Alert tone="success" title="Accepted">
                  The learner accepted your bid and has a few minutes to pay.{' '}
                  <Link to="/sessions" className="link">
                    See sessions
                  </Link>
                </Alert>
              )}
              {withdraw.error && <Alert tone="danger">{describeAuthError(withdraw.error)}</Alert>}
            </Card>
          ) : open ? (
            <BidForm
              target={{ kind: 'request', id: r.id }}
              existing={editing ? bid : null}
              onDone={() => setEditing(false)}
            />
          ) : (
            <Alert tone="info">This request is no longer taking bids.</Alert>
          )}
        </aside>
      </div>
    </article>
  );
}

export type BidTarget =
  { kind: 'request'; id: string } | { kind: 'pool'; id: string; seatCap: number };

/** Sealed bid on a single learner's request, or a group bid (seat price + seat limits) on a pool. */
export function BidForm({
  target,
  existing,
  onDone,
}: {
  target: BidTarget;
  existing: Bid | null;
  onDone: () => void;
}) {
  const pool = target.kind === 'pool' ? target : null;
  const [minSeats, setMinSeats] = useState('2');
  const [maxSeats, setMaxSeats] = useState(String(pool ? Math.max(2, pool.seatCap) : 2));
  const qc = useQueryClient();
  const [price, setPrice] = useState(existing ? String(existing.seatPricePaise / 100) : '');
  const [start, setStart] = useState(
    existing ? toLocalInput(new Date(existing.proposedStartAt)) : defaultStart(),
  );
  const [duration, setDuration] = useState(String(existing?.durationMinutes ?? 60));
  const [approach, setApproach] = useState(existing?.approachText ?? '');
  const [local, setLocal] = useState<Record<string, string>>({});
  const [bounds] = useState(() => ({
    min: toLocalInput(new Date(Date.now() + MIN_LEAD_MS)),
    max: toLocalInput(new Date(Date.now() + MAX_LEAD_MS)),
  }));
  const save = useMutation({
    mutationFn: (body: {
      seatPricePaise: number;
      proposedStartAt: string;
      durationMinutes: number;
      approachText: string;
    }) =>
      pool
        ? unwrap<Bid>(
            api.POST('/tutor/pools/{id}/bids', {
              params: { path: { id: pool.id } },
              body: { ...body, minSeats: Number(minSeats), maxSeats: Number(maxSeats) },
            }),
          )
        : existing
          ? unwrap<Bid>(
              api.PATCH('/tutor/bids/{id}', { params: { path: { id: existing.id } }, body }),
            )
          : unwrap<Bid>(
              api.POST('/tutor/requests/{id}/bids', { params: { path: { id: target.id } }, body }),
            ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketKey });
      void qc.invalidateQueries({ queryKey: ['tutor', 'bids'] });
      void qc.invalidateQueries({ queryKey: ['tutor', 'pools'] });
      onDone();
    },
  });
  const server = (k: string) =>
    save.error instanceof ApiError ? save.error.fieldErrors[k]?.[0] : undefined;
  const top =
    save.error instanceof ApiError && save.error.code === 'INVALID_START_TIME'
      ? 'Start time must be between 15 minutes and 30 days from now.'
      : save.error && !(save.error instanceof ApiError && save.error.code === 'VALIDATION_FAILED')
        ? describeAuthError(save.error)
        : null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const paise = rupeesToPaise(price);
    if (paise === undefined || Number.isNaN(paise) || paise < 100)
      next.price = 'Enter a price of at least ₹1.';
    const at = new Date(start).getTime();
    const lead = at - Date.now();
    if (Number.isNaN(at) || lead < MIN_LEAD_MS || lead > MAX_LEAD_MS)
      next.start = 'Pick a time between 15 minutes and 30 days from now.';
    if (!approach.trim()) next.approach = 'Tell the learner how you would teach this.';
    if (pool) {
      const lo = Number(minSeats);
      const hi = Number(maxSeats);
      if (!Number.isInteger(lo) || lo < 2) next.minSeats = 'At least 2 learners.';
      if (!Number.isInteger(hi) || hi < lo) next.maxSeats = 'Must be at least the minimum.';
    }
    setLocal(next);
    if (Object.keys(next).length) return;
    save.mutate({
      seatPricePaise: paise!,
      proposedStartAt: new Date(start).toISOString(),
      durationMinutes: Number(duration),
      approachText: approach.trim(),
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5 border-t-8 border-brand bg-surface p-6"
    >
      <p className="text-sm text-muted">
        Learners rank bids on teaching outcomes, ratings, price and timing. Your price stays sealed
        from other tutors.
      </p>
      {top && <Alert tone="danger">{top}</Alert>}
      <Field
        label={pool ? 'Price per seat, ₹' : 'Your price for the session, ₹'}
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        error={local.price ?? server('seatPricePaise')}
        hint="Tutora keeps a 10% platform fee when the money is released to you."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Start"
          type="datetime-local"
          value={start}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => setStart(e.target.value)}
          error={local.start ?? server('proposedStartAt')}
        />
        <Select
          label="Length"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          error={server('durationMinutes')}
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d < 60 ? `${d} minutes` : `${d / 60} hour${d > 60 ? 's' : ''}`}
            </option>
          ))}
        </Select>
      </div>
      {pool && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Minimum learners"
            type="number"
            min={2}
            max={50}
            value={minSeats}
            onChange={(e) => setMinSeats(e.target.value)}
            hint="The session runs only if this many pay."
            error={local.minSeats ?? server('minSeats')}
          />
          <Field
            label="Maximum learners"
            type="number"
            min={2}
            max={50}
            value={maxSeats}
            onChange={(e) => setMaxSeats(e.target.value)}
            hint={`This group has up to ${pool.seatCap} seats.`}
            error={local.maxSeats ?? server('maxSeats')}
          />
        </div>
      )}
      <Textarea
        label="Your approach"
        rows={5}
        maxLength={2000}
        value={approach}
        onChange={(e) => setApproach(e.target.value)}
        hint="What you'll cover and how. Keep contact details out: they're hidden automatically."
        error={local.approach ?? server('approachText')}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          {existing ? 'Update bid' : pool ? 'Send group bid' : 'Send sealed bid'}
        </Button>
        {existing && (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
