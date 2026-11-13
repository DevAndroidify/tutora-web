import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, unwrap } from '@tutora/api-client';
import {
  formatDateTime,
  formatINR,
  rupeesToPaise,
  type LedgerBalance,
  type Payment,
  type PaymentStatus,
  type Payout,
} from '@tutora/core';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  Modal,
  PageHeader,
  SectionHeader,
  Stat,
  StatusTag,
  Tabs,
  Tag,
} from '@tutora/ui';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { fieldErr, ReasonDialog, topError } from '../components';
import {
  ACCOUNT_LABELS,
  moneyKeys,
  splitAccount,
  useBalances,
  useLedgerCheck,
  useLowBandwidth,
  usePayments,
  useReconciliation,
  useTutorName,
} from '../money';

export type MoneyTab = 'payments' | 'payouts' | 'books' | 'connectivity';
const TABS: Array<{ value: MoneyTab; label: string }> = [
  { value: 'payments', label: 'Payments' },
  { value: 'payouts', label: 'Payouts' },
  { value: 'books', label: 'Books' },
  { value: 'connectivity', label: 'Connectivity' },
];

export function MoneyPage({ tab, onTab }: { tab: MoneyTab; onTab: (tab: MoneyTab) => void }) {
  return (
    <>
      <PageHeader
        kicker="Money"
        title="Payments and payouts"
        description="Learner money is held until a session ends and its dispute window closes. Releases, refunds and payouts are audited and need a note."
      />
      <Tabs label="Money sections" items={TABS} value={tab} onChange={onTab} />
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'payouts' && <PayoutsTab />}
      {tab === 'books' && <BooksTab />}
      {tab === 'connectivity' && <ConnectivityTab />}
    </>
  );
}

// ---------------- payments ----------------

type PayFilter = 'ALL' | PaymentStatus;
const PAY_FILTERS: Array<{ value: PayFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'HELD', label: 'Held' },
  { value: 'FROZEN', label: 'Frozen' },
  { value: 'INITIATED', label: 'Initiated' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'FAILED', label: 'Failed' },
];

type MoneyAction = { kind: 'release' | 'refund'; payment: Payment };

function PaymentsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<PayFilter>('HELD');
  const payments = usePayments(filter === 'ALL' ? undefined : filter);
  const [action, setAction] = useState<MoneyAction | null>(null);
  const act = useMutation({
    mutationFn: ({ kind, payment, note }: MoneyAction & { note: string }) =>
      unwrap<{ paymentId: string; status: string }>(
        kind === 'release'
          ? api.POST('/admin/payments/{id}/release', {
              params: { path: { id: payment.id } },
              body: { note },
            })
          : api.POST('/admin/payments/{id}/refund', {
              params: { path: { id: payment.id } },
              body: { note },
            }),
      ),
    onSuccess: () => {
      setAction(null);
      void qc.invalidateQueries({ queryKey: moneyKeys.all });
    },
  });

  return (
    <section aria-labelledby="payments-h">
      <h2 id="payments-h" className="sr-only">
        Payments
      </h2>
      <Tabs label="Filter payments" items={PAY_FILTERS} value={filter} onChange={setFilter} />
      {payments.isPending ? (
        <Loading />
      ) : payments.isError ? (
        <Alert tone="danger">{payments.error.message}</Alert>
      ) : payments.data.length === 0 ? (
        <EmptyState title="No payments here" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Payments, newest first</caption>
            <thead>
              <tr className="border-b-2 border-text text-left text-xs">
                <th scope="col" className="py-2">
                  Created
                </th>
                <th scope="col" className="py-2">
                  Order
                </th>
                <th scope="col" className="py-2">
                  Status
                </th>
                <th scope="col" className="py-2 text-right">
                  Amount
                </th>
                <th scope="col" className="py-2 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.data.map((p) => (
                <tr key={p.id} className="border-b border-border align-top">
                  <td className="py-3">{formatDateTime(p.createdAt)}</td>
                  <td className="py-3">
                    <span className="font-mono text-xs">{p.providerOrderId}</span>
                    <span className="ml-2 text-xs text-muted">{p.provider}</span>
                    {(p.failureReason || p.refundReason) && (
                      <p className="text-xs text-muted">{p.failureReason ?? p.refundReason}</p>
                    )}
                  </td>
                  <td className="py-3">
                    <StatusTag status={p.status} />
                  </td>
                  <td className="py-3 text-right font-bold">{formatINR(p.amountPaise)}</td>
                  <td className="py-3 text-right">
                    {p.status === 'HELD' && (
                      <span className="inline-flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => setAction({ kind: 'release', payment: p })}
                        >
                          Release
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setAction({ kind: 'refund', payment: p })}
                        >
                          Refund
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReasonDialog
        key={action ? `${action.kind}:${action.payment.id}` : 'none'}
        open={!!action}
        title={
          action?.kind === 'release'
            ? `Release ${formatINR(action.payment.amountPaise)} to the tutor?`
            : `Refund ${formatINR(action?.payment.amountPaise ?? 0)} to the learner?`
        }
        confirmLabel={action?.kind === 'release' ? 'Release now' : 'Refund now'}
        danger={action?.kind === 'refund'}
        field="note"
        label="Note"
        hint="Why you are overriding the automatic release. Kept in the audit log."
        pending={act.isPending}
        error={act.error}
        onClose={() => {
          setAction(null);
          act.reset();
        }}
        onConfirm={(note) => action && act.mutate({ ...action, note })}
      >
        <p className="text-sm text-muted">
          Held money is normally released automatically after the dispute window. Use this only when
          you have a reason to act early.
        </p>
      </ReasonDialog>
    </section>
  );
}

// ---------------- payouts ----------------

function OwedRow({ account, onPay }: { account: LedgerBalance; onPay: () => void }) {
  const { userId } = splitAccount(account.code);
  const name = useTutorName(userId);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
      <div>
        <p className="font-bold">{name.data ?? 'Tutor'}</p>
        <p className="font-mono text-xs text-muted">{userId}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-display text-2xl font-extrabold">
          {formatINR(account.balancePaise)}
        </span>
        <Button onClick={onPay}>Record payout</Button>
      </div>
    </li>
  );
}

function PayoutsTab() {
  const balances = useBalances();
  const [paying, setPaying] = useState<{ userId: string; owed: number } | null>(null);
  const [last, setLast] = useState<Payout | null>(null);
  const owed = (balances.data ?? []).filter(
    (a) => splitAccount(a.code).kind === 'tutor_payable' && a.balancePaise > 0,
  );
  return (
    <section aria-labelledby="owed" className="grid gap-10 lg:grid-cols-[3fr_2fr]">
      <div>
        <SectionHeader id="owed" title="Owed to tutors" />
        {last && (
          <div className="mb-4">
            <Alert tone="success" title="Payout recorded">
              {formatINR(last.amountPaise)} · reference {last.reference}
            </Alert>
          </div>
        )}
        {balances.isPending ? (
          <Loading />
        ) : balances.isError ? (
          <Alert tone="danger">{balances.error.message}</Alert>
        ) : owed.length === 0 ? (
          <EmptyState title="Nobody is owed money">
            Released earnings appear here until you record a payout.
          </EmptyState>
        ) : (
          <ul>
            {owed.map((a) => (
              <OwedRow
                key={a.code}
                account={a}
                onPay={() =>
                  setPaying({ userId: splitAccount(a.code).userId!, owed: a.balancePaise })
                }
              />
            ))}
          </ul>
        )}
      </div>
      <aside>
        <Alert tone="info" title="How payouts work">
          Send the money to the tutor's UPI ID from the company account first, then record it here
          with the UPI transaction reference (UTR). Recording moves it out of what they are owed.
        </Alert>
      </aside>
      {paying && (
        <PayoutDialog
          tutorUserId={paying.userId}
          owedPaise={paying.owed}
          onClose={() => setPaying(null)}
          onDone={(p) => {
            setLast(p);
            setPaying(null);
          }}
        />
      )}
    </section>
  );
}

function PayoutDialog({
  tutorUserId,
  owedPaise,
  onClose,
  onDone,
}: {
  tutorUserId: string;
  owedPaise: number;
  onClose: () => void;
  onDone: (p: Payout) => void;
}) {
  const qc = useQueryClient();
  const name = useTutorName(tutorUserId);
  const [amount, setAmount] = useState(String(owedPaise / 100));
  const [reference, setReference] = useState('');
  const [local, setLocal] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: { tutorUserId: string; amountPaise: number; reference: string }) =>
      unwrap<Payout>(api.POST('/admin/payouts', { body })),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: moneyKeys.all });
      onDone(p);
    },
  });
  const tooMuch =
    save.error instanceof ApiError && save.error.code === 'PAYOUT_EXCEEDS_BALANCE'
      ? 'That is more than the tutor is owed.'
      : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const paise = rupeesToPaise(amount);
    if (paise === undefined || Number.isNaN(paise) || paise < 100)
      next.amount = 'Enter at least ₹1.';
    else if (paise > owedPaise) next.amount = `At most ${formatINR(owedPaise)}.`;
    const ref = reference.trim();
    if (ref.length < 6 || ref.length > 64) next.reference = 'UPI references are 6–64 characters.';
    setLocal(next);
    if (Object.keys(next).length) return;
    save.mutate({ tutorUserId, amountPaise: paise!, reference: ref });
  };
  return (
    <Modal open title={`Record a payout to ${name.data ?? 'this tutor'}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-muted">Owed: {formatINR(owedPaise)}</p>
        {(tooMuch || topError(save.error)) && (
          <Alert tone="danger">{tooMuch ?? topError(save.error)}</Alert>
        )}
        <Field
          label="Amount sent, ₹"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={local.amount ?? fieldErr(save.error, 'amountPaise')}
        />
        <Field
          label="UPI transaction reference (UTR)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={local.reference ?? fieldErr(save.error, 'reference')}
          hint="Each reference can be recorded once."
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Record payout
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------- books ----------------

function BooksTab() {
  const balances = useBalances();
  const ledger = useLedgerCheck();
  const [runCheck, setRunCheck] = useState(false);
  const rec = useReconciliation(runCheck);
  const accounts = balances.data ?? [];
  const grouped = new Map<string, { label: string; balance: number; n: number }>();
  for (const a of accounts) {
    const { kind } = splitAccount(a.code);
    const g = grouped.get(kind) ?? { label: ACCOUNT_LABELS[kind] ?? kind, balance: 0, n: 0 };
    g.balance += a.balancePaise;
    g.n += 1;
    grouped.set(kind, g);
  }
  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="ledger-h">
        <SectionHeader id="ledger-h" title="Ledger" />
        {ledger.isPending ? (
          <Loading />
        ) : ledger.isError ? (
          <Alert tone="danger">{ledger.error.message}</Alert>
        ) : (
          <div className="grid gap-8 sm:grid-cols-3">
            <Stat
              label="Books"
              value={ledger.data.balanced ? 'Balanced' : 'Unbalanced'}
              hint={
                ledger.data.balanced ? undefined : (
                  <span className="font-bold text-danger">
                    {ledger.data.unbalancedTransactions.length} bad transactions
                  </span>
                )
              }
            />
            <Stat label="Total debits" value={formatINR(ledger.data.totalDebitsPaise)} />
            <Stat label="Transactions" value={ledger.data.transactionCount} />
          </div>
        )}
      </section>
      <section aria-labelledby="accounts-h">
        <SectionHeader id="accounts-h" title="Accounts" />
        {balances.isPending ? (
          <Loading />
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Ledger balance by account type</caption>
            <tbody>
              {[...grouped.entries()].map(([kind, g]) => (
                <tr key={kind} className="border-b border-border">
                  <th scope="row" className="py-3 text-left font-semibold">
                    {g.label}
                    {g.n > 1 && <span className="ml-2 text-xs text-muted">{g.n} accounts</span>}
                  </th>
                  <td className="py-3 text-right font-bold">{formatINR(g.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section aria-labelledby="rec-h">
        <SectionHeader id="rec-h" title="Reconciliation" />
        <p className="mb-4 max-w-2xl text-sm text-muted">
          Compares the ledger with every payment record and asks the payment provider about recent
          payments. An empty list means the books agree.
        </p>
        <Button
          loading={rec.isFetching}
          onClick={() => (runCheck ? void rec.refetch() : setRunCheck(true))}
        >
          {rec.data ? 'Run again' : 'Run reconciliation'}
        </Button>
        {rec.isError && (
          <div className="mt-4">
            <Alert tone="danger">{rec.error.message}</Alert>
          </div>
        )}
        {rec.data && (
          <Card className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Tag tone={rec.data.ok ? 'success' : 'danger'}>
                {rec.data.ok ? 'All clear' : `${rec.data.mismatches.length} mismatches`}
              </Tag>
              <span className="text-sm text-muted">
                {rec.data.paymentsChecked} payments · {rec.data.providerChecked} checked with the
                provider · {formatINR(rec.data.heldFundsPaise)} held
              </span>
            </div>
            {rec.data.mismatches.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {rec.data.mismatches.map((m, i) => (
                  <li key={i} className="border-l-4 border-danger pl-3">
                    <strong>{m.check.replace(/_/g, ' ')}</strong>
                    {m.paymentId && <span className="ml-2 font-mono text-xs">{m.paymentId}</span>}
                    <p className="font-mono text-xs text-muted">
                      expected {JSON.stringify(m.expected)} · got {JSON.stringify(m.actual)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}

// ---------------- connectivity ----------------

const MODE_LABELS: Record<string, string> = {
  FULL_VIDEO: 'Full video',
  AUDIO_ONLY: 'Audio only',
  WHITEBOARD_ONLY: 'Whiteboard only',
};

function ConnectivityTab() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const m = useLowBandwidth(Number(days));
  return (
    <section aria-labelledby="conn-h">
      <SectionHeader id="conn-h" title="Low-bandwidth sessions" />
      <Tabs
        label="Period"
        items={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
        ]}
        value={days}
        onChange={setDays}
      />
      {m.isPending ? (
        <Loading />
      ) : m.isError ? (
        <Alert tone="danger">{m.error.message}</Alert>
      ) : m.data.sessionsReporting === 0 ? (
        <EmptyState title="No sessions reported connection data in this period" />
      ) : (
        <>
          <div className="grid gap-8 sm:grid-cols-3">
            <Stat
              label="Switched to a lighter mode"
              value={`${Math.round(m.data.lowBandwidthShare * 100)}%`}
              hint={`${m.data.lowBandwidthSessions} of ${m.data.sessionsReporting} sessions`}
            />
            <Stat
              label="Average downlink"
              value={m.data.avgDownlinkKbps === null ? '—' : `${m.data.avgDownlinkKbps} kbps`}
            />
            <Stat label="Sessions reporting" value={m.data.sessionsReporting} />
          </div>
          <ul className="mt-10 flex flex-col gap-3" aria-label="Sessions by mode">
            {m.data.byMode.map((row) => {
              const pct = Math.round((row.sessions / m.data.sessionsReporting) * 100);
              return (
                <li key={row.mode} className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3">
                  <span className="text-sm font-semibold">{MODE_LABELS[row.mode] ?? row.mode}</span>
                  <span className="h-4 bg-surface" aria-hidden>
                    <span className="block h-full bg-text" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-right text-sm font-bold">{row.sessions}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
