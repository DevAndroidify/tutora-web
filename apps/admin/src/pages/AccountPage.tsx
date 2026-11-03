import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import { formatDate, humanize, type SessionUser } from '@tutora/core';
import { Alert, Card, Facts, Loading, PageHeader, StatusTag } from '@tutora/ui';
import { api } from '../api';

/** Reads the signed-in user from GET /admin/me. */
export function AccountPage() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => unwrap<SessionUser & { createdAt: string }>(api.GET('/admin/me')),
  });
  return (
    <>
      <PageHeader kicker="Your account" title="Account" />
      {me.isPending && <Loading />}
      {me.isError && <Alert tone="danger">{me.error.message}</Alert>}
      {me.data && (
        <div className="max-w-2xl">
          <Card>
            <Facts
              items={[
                ['Name', me.data.fullName],
                ['Email', me.data.email],
                [
                  'Account',
                  me.data.accountType === 'STAFF'
                    ? `Staff (${humanize(me.data.staffRole ?? '')})`
                    : 'Member',
                ],
                ['Status', <StatusTag key="s" status={me.data.status} />],
                ['Member since', formatDate(me.data.createdAt)],
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}
