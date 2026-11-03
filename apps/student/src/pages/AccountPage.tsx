import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import type { SessionUser } from '@tutora/core';
import { Alert, Card, PageHeader, Spinner } from '@tutora/ui';
import { api } from '../api';

/** Reads the signed-in user from GET /student/me. */
export function AccountPage() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => unwrap<SessionUser & { createdAt: string }>(api.GET('/student/me')),
  });
  return (
    <>
      <PageHeader title="Account" />
      {me.isPending && <Spinner />}
      {me.isError && <Alert tone="danger">{me.error.message}</Alert>}
      {me.data && (
        <Card>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-3 text-sm">
            <dt className="text-muted">Name</dt>
            <dd>{me.data.fullName}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{me.data.email}</dd>
            <dt className="text-muted">Account</dt>
            <dd>{me.data.accountType === 'STAFF' ? `Staff (${me.data.staffRole})` : 'Member'}</dd>
            <dt className="text-muted">Status</dt>
            <dd>{me.data.status}</dd>
            <dt className="text-muted">Member since</dt>
            <dd>{new Date(me.data.createdAt).toLocaleDateString()}</dd>
          </dl>
        </Card>
      )}
    </>
  );
}
