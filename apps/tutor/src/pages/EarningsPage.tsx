import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import { formatDateTime, formatINR, useRealtimeEvent, type Earnings } from '@tutora/core';
import {
  Alert,
  Card,
  EmptyState,
  Facts,
  Loading,
  PageHeader,
  SectionHeader,
  Stat,
} from '@tutora/ui';
import { api } from '../api';
import { useMyProfile } from '../profile';

export const earningsKey = ['tutor', 'earnings'] as const;

/** Basis points as a percentage label (1000 -> "10%"). */
export const feeLabel = (bps: number) => `${(bps / 100).toLocaleString('en-IN')}%`;

export function EarningsPage() {
  const qc = useQueryClient();
  const profile = useMyProfile();
  const earnings = useQuery({
    queryKey: earningsKey,
    queryFn: () => unwrap<Earnings>(api.GET('/tutor/earnings')),
  });
  // Money moves on payment, release, refund and payout notifications.
  useRealtimeEvent<{ type: string }>('notification.created', (n) => {
    if (/^(payment|payout|dispute|session)\./.test(n.type))
      void qc.invalidateQueries({ queryKey: earningsKey });
  });

  if (earnings.isPending) return <Loading />;
  if (earnings.isError) return <Alert tone="danger">{earnings.error.message}</Alert>;
  const e = earnings.data;
  const upi = profile.data?.payoutUpiId;
  const paidOut = e.payouts.reduce((n, p) => n + p.amountPaise, 0);

  return (
    <>
      <PageHeader
        kicker="Money"
        title="Earnings"
        description="Learners pay Tutora up front. We hold the money until the session ends and the dispute window closes, then release it to you, less the platform fee."
      />
      <section aria-labelledby="totals" className="mb-12">
        <h2 id="totals" className="sr-only">
          Totals
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          <Stat
            label="Ready to pay out"
            value={formatINR(e.availablePaise)}
            hint="After the platform fee"
          />
          <Stat
            label="Held for upcoming sessions"
            value={formatINR(e.pendingGrossPaise)}
            hint="Gross, released after each session"
          />
          <Stat
            label="Released so far"
            value={formatINR(e.releasedGrossPaise)}
            hint={`Gross, before the ${feeLabel(e.platformFeeBps)} fee`}
          />
        </div>
      </section>
      <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="payouts">
          <SectionHeader id="payouts" title="Payouts" />
          {e.payouts.length === 0 ? (
            <EmptyState title="No payouts yet">
              Payouts are sent by UPI once money is released to you.
            </EmptyState>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Payouts sent to you</caption>
              <thead>
                <tr className="border-b-2 border-text text-left text-xs uppercase tracking-[0.12em]">
                  <th scope="col" className="py-2">
                    Date
                  </th>
                  <th scope="col" className="py-2">
                    UPI reference
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {e.payouts.map((p) => (
                  <tr key={p.id} className="border-b border-border">
                    <td className="py-3">{formatDateTime(p.createdAt)}</td>
                    <td className="py-3 font-mono text-xs">{p.reference}</td>
                    <td className="py-3 text-right font-bold">{formatINR(p.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2} className="py-3 text-left text-xs uppercase">
                    Total (last {e.payouts.length})
                  </th>
                  <td className="py-3 text-right font-display text-xl font-black">
                    {formatINR(paidOut)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
        <aside className="flex flex-col gap-6">
          <Card>
            <Facts
              items={[
                ['Payout method', 'Manual UPI transfer'],
                [
                  'UPI ID',
                  upi ? (
                    <span className="font-mono">{upi}</span>
                  ) : (
                    <Link to="/profile" className="link font-bold text-danger">
                      Add one to get paid
                    </Link>
                  ),
                ],
                ['Platform fee', feeLabel(e.platformFeeBps)],
                ['Currency', e.currency],
              ]}
            />
          </Card>
          <Alert tone="info" title="When is money released?">
            After a session ends, a short dispute window opens for the learner. If nobody disputes,
            the money is released automatically. If they do, it stays frozen until our team decides.
          </Alert>
        </aside>
      </div>
    </>
  );
}
