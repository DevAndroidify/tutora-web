import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import type {
  AdminDispute,
  DisputeStatus,
  LedgerBalance,
  LedgerCheck,
  LowBandwidthMetrics,
  Payment,
  PaymentStatus,
  PublicTutor,
  Reconciliation,
} from '@tutora/core';
import { api, publicApi } from './api';

export const moneyKeys = {
  all: ['admin', 'money'] as const,
  payments: (status?: PaymentStatus) => ['admin', 'money', 'payments', status ?? 'ALL'] as const,
  disputes: (status?: DisputeStatus) => ['admin', 'disputes', status ?? 'ALL'] as const,
  balances: ['admin', 'money', 'balances'] as const,
  ledger: ['admin', 'money', 'ledger'] as const,
  reconciliation: ['admin', 'money', 'reconciliation'] as const,
  lowBandwidth: (days: number) => ['admin', 'metrics', 'low-bandwidth', days] as const,
};

export const usePayments = (status?: PaymentStatus) =>
  useQuery({
    queryKey: moneyKeys.payments(status),
    queryFn: () => unwrap<Payment[]>(api.GET('/admin/payments', { params: { query: { status } } })),
  });

export const useDisputes = (status?: DisputeStatus) =>
  useQuery({
    queryKey: moneyKeys.disputes(status),
    queryFn: () =>
      unwrap<AdminDispute[]>(api.GET('/admin/disputes', { params: { query: { status } } })),
  });

export const useBalances = () =>
  useQuery({
    queryKey: moneyKeys.balances,
    queryFn: () => unwrap<LedgerBalance[]>(api.GET('/admin/ledger/balances')),
  });

export const useLedgerCheck = () =>
  useQuery({
    queryKey: moneyKeys.ledger,
    queryFn: () => unwrap<LedgerCheck>(api.GET('/admin/ledger/reconciliation')),
  });

/** The full check also asks the payment provider about recent payments, so it runs on demand. */
export const useReconciliation = (enabled: boolean) =>
  useQuery({
    queryKey: moneyKeys.reconciliation,
    queryFn: () => unwrap<Reconciliation>(api.GET('/admin/reconciliation')),
    enabled,
    staleTime: 0,
  });

export const useLowBandwidth = (days: number) =>
  useQuery({
    queryKey: moneyKeys.lowBandwidth(days),
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - days * 86_400_000);
      return unwrap<LowBandwidthMetrics>(
        api.GET('/admin/metrics/low-bandwidth', {
          params: { query: { from: from.toISOString(), to: to.toISOString() } },
        }),
      );
    },
  });

/** Public name for a user id (tutors only; learners have no public profile). */
export const useTutorName = (userId: string | undefined) =>
  useQuery({
    queryKey: ['public', 'tutor', userId],
    queryFn: () =>
      unwrap<PublicTutor>(
        publicApi.GET('/public/tutors/{userId}', { params: { path: { userId: userId! } } }),
      ),
    enabled: !!userId,
    retry: false,
    select: (t) => t.fullName,
  });

/** Ledger account codes are "kind" or "kind:<userId>". */
export function splitAccount(code: string): { kind: string; userId?: string } {
  const [kind, userId] = code.split(':');
  return { kind: kind!, userId };
}

export const ACCOUNT_LABELS: Record<string, string> = {
  gateway_clearing: 'With the payment provider',
  held_funds: 'Learner money held',
  tutor_payable: 'Owed to tutor',
  platform_revenue: 'Platform fees',
  payout_clearing: 'Paid out to tutors',
};
