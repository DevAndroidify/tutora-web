import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, newIdempotencyKey, unwrap } from '@tutora/api-client';
import {
  API_BASE_URL,
  describeAuthError,
  formatCountdown,
  formatINR,
  useNow,
  type Payment,
  type SessionSeat,
} from '@tutora/core';
import { Alert, Button, Tag } from '@tutora/ui';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { sessionsKey } from './SessionsPage';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open(): void;
      on(event: string, fn: (e: unknown) => void): void;
    };
  }
}

/** One idempotency key per payment attempt, kept across reloads so a retry never double-charges. */
function attemptKey(participantId: string, fresh = false): string {
  const k = `tutora.pay.${participantId}`;
  try {
    const existing = fresh ? null : sessionStorage.getItem(k);
    if (existing) return existing;
    const key = newIdempotencyKey();
    sessionStorage.setItem(k, key);
    return key;
  } catch {
    return newIdempotencyKey();
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = RAZORPAY_SCRIPT;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay checkout.'));
    document.head.appendChild(s);
  });
}

/** Pay for a held seat with UPI. Test mode only: the backend refuses live keys. */
export function Checkout({ seat }: { seat: SessionSeat }) {
  const qc = useQueryClient();
  const now = useNow();
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const due = seat.paymentDueAt ? new Date(seat.paymentDueAt).getTime() : null;
  const left = due ? due - now : null;
  const expired = left !== null && left <= 0;

  const payment = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () =>
      unwrap<Payment>(api.GET('/student/payments/{id}', { params: { path: { id: paymentId! } } })),
    enabled: !!paymentId,
    // Poll until the webhook marks it held or failed.
    refetchInterval: (q) => (q.state.data?.status === 'INITIATED' || !q.state.data ? 1500 : false),
  });
  const status = payment.data?.status;
  useEffect(() => {
    if (status === 'HELD') void qc.invalidateQueries({ queryKey: sessionsKey });
  }, [status, qc]);

  const start = useMutation({
    mutationFn: async (fresh: boolean) => {
      const created = await unwrap<Payment>(
        api.POST('/student/participants/{id}/payments', {
          params: {
            path: { id: seat.participantId },
            header: { 'Idempotency-Key': attemptKey(seat.participantId, fresh) },
          },
        }),
      );
      setPaymentId(created.id);
      qc.setQueryData(['payment', created.id], created);
      return created;
    },
  });
  const simulate = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(
        `${API_BASE_URL}/dev/fake-upi/orders/${encodeURIComponent(orderId)}/pay`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      );
      if (!res.ok)
        throw new ApiError(
          res.status,
          'SIMULATOR_FAILED',
          'The payment simulator did not accept this order.',
        );
      await payment.refetch();
    },
  });
  const openRazorpay = async (p: Payment) => {
    if (p.checkout?.provider !== 'razorpay') return;
    setCheckoutError(null);
    try {
      await loadRazorpay();
      const rzp = new window.Razorpay!({
        key: p.checkout.keyId,
        order_id: p.checkout.orderId,
        amount: p.checkout.amount,
        currency: p.checkout.currency,
        name: 'Tutora',
        description: 'Session seat (held until the session ends)',
        ...p.checkout.checkoutOptions,
        handler: async (r: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // The webhook is the source of truth; confirming just makes the update faster.
          await unwrap(
            api.POST('/student/payments/{id}/confirm', { params: { path: { id: p.id } }, body: r }),
          ).catch(() => undefined);
          void payment.refetch();
        },
        modal: { ondismiss: () => void payment.refetch() },
      });
      rzp.on('payment.failed', () => void payment.refetch());
      rzp.open();
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Checkout failed to open.');
    }
  };

  // Status polls return the payment without checkout details, so keep the ones from creation.
  const base = payment.data ?? start.data;
  const p = base ? { ...base, checkout: base.checkout ?? start.data?.checkout } : undefined;
  return (
    <section
      aria-labelledby="pay"
      className="lift-lg grid gap-0 overflow-hidden rounded-[var(--radius-card)] border-2 border-ink lg:grid-cols-[3fr_2fr]"
    >
      <div className="border-b-2 border-ink bg-brand p-8 text-[#16161a] lg:border-r-2 lg:border-b-0">
        <p id="pay" className="text-sm font-bold">
          {expired ? 'Seat released' : 'Seat held for you'}
        </p>
        <p className="mt-2 font-display text-7xl font-extrabold leading-none">
          {expired ? '0:00' : left !== null ? formatCountdown(left) : '—'}
        </p>
        <p className="mt-4 max-w-md text-[15px]">
          {expired
            ? 'The payment window closed, so the request reopened for bids. You can accept another bid.'
            : 'Pay before the timer runs out. Tutora holds the money and releases it to the tutor after the session; disputes are reviewed by our team.'}
        </p>
      </div>
      <div className="flex flex-col gap-4 bg-surface p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-5xl font-extrabold">{formatINR(seat.amountPaise)}</p>
          <Tag tone="warning">Test mode</Tag>
        </div>
        <p className="text-xs text-muted">
          Payments use test credentials only. No real money moves.
        </p>
        {status === 'HELD' ? (
          <Alert tone="success" title="Paid">
            Your session is booked.
          </Alert>
        ) : status === 'FAILED' ? (
          <>
            <Alert tone="danger" title="Payment failed">
              {p?.failureReason ?? 'Try again with another UPI app.'}
            </Alert>
            <Button disabled={expired} loading={start.isPending} onClick={() => start.mutate(true)}>
              Try again
            </Button>
          </>
        ) : !p ? (
          <Button
            className="py-4"
            disabled={expired}
            loading={start.isPending}
            onClick={() => start.mutate(false)}
          >
            Pay with UPI
          </Button>
        ) : p.checkout?.provider === 'razorpay' ? (
          <Button className="py-4" onClick={() => void openRazorpay(p)}>
            Open Razorpay checkout
          </Button>
        ) : p.checkout?.provider === 'fake' ? (
          <div className="flex flex-col gap-3 border-2 border-dashed border-border p-4">
            <p className="text-xs font-bold text-muted">Payment simulator (development)</p>
            <p className="text-sm">
              Order {p.checkout.orderId}. Approve it as if you paid in a UPI app.
            </p>
            <Button
              loading={simulate.isPending}
              onClick={() => simulate.mutate(p.checkout!.orderId)}
            >
              Approve test payment
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Waiting for the payment to confirm…</p>
        )}
        {(start.error || simulate.error || checkoutError) && (
          <Alert tone="danger">
            {checkoutError ?? describeAuthError(start.error ?? simulate.error)}
          </Alert>
        )}
      </div>
    </section>
  );
}
