import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import { describeAuthError, humanize, type OpenPool } from '@tutora/core';
import { useSkill } from '@tutora/core/catalog';
import { Alert, Button, EmptyState, Kicker, Loading, PageHeader, StatusTag } from '@tutora/ui';
import { useState } from 'react';
import { api } from '../api';
import { BidForm } from './MarketRequestPage';

export const poolsKey = ['tutor', 'pools'] as const;

function PoolRow({ pool }: { pool: OpenPool }) {
  const skill = useSkill(pool.skillId);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <li className="border-t border-border py-6 first:border-t-2 first:border-text">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Kicker className="mb-1">
            {skill.data?.name ?? 'Skill'} · {humanize(pool.level)}
          </Kicker>
          <h2 className="text-2xl font-extrabold leading-tight">
            {pool.members} learners want the same thing
          </h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            Up to {pool.seatCap} seats · learners stay anonymous until they pay
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusTag status={pool.status} />
          {!sent && (
            <Button
              variant={open ? 'ghost' : 'primary'}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? 'Close' : 'Bid on this group'}
            </Button>
          )}
        </div>
      </div>
      {sent && (
        <div className="mt-4">
          <Alert tone="success" title="Group bid sent">
            Members see every offer. The first to accept fixes it for the whole group, then each
            learner pays for their own seat.
          </Alert>
        </div>
      )}
      {open && !sent && (
        <div className="mt-5 max-w-2xl">
          <BidForm
            target={{ kind: 'pool', id: pool.id, seatCap: pool.seatCap }}
            existing={null}
            onDone={() => {
              setOpen(false);
              setSent(true);
            }}
          />
        </div>
      )}
    </li>
  );
}

export function GroupsPage() {
  const pools = useQuery({
    queryKey: poolsKey,
    queryFn: () => unwrap<OpenPool[]>(api.GET('/tutor/pools')),
    retry: false,
  });
  return (
    <>
      <PageHeader
        kicker="Group sessions"
        title="Groups looking for a tutor"
        description="Tutora groups learners whose requests are almost the same. Bid a price per seat and the smallest group you'll teach; the session runs only if that many learners pay."
      />
      {pools.isPending ? (
        <Loading />
      ) : pools.isError ? (
        <Alert tone="warning" title="Groups aren't available to you yet">
          {describeAuthError(pools.error)}
        </Alert>
      ) : pools.data.length === 0 ? (
        <EmptyState title="No groups right now">
          Groups form when several learners ask for the same skill and level. They appear here for
          your approved skills.
        </EmptyState>
      ) : (
        <ul>
          {pools.data.map((p) => (
            <PoolRow key={p.id} pool={p} />
          ))}
        </ul>
      )}
    </>
  );
}
