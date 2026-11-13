import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import { APP_URLS, formatDate, humanize, type SessionUser } from '@tutora/core';
import { Alert, Card, Facts, Loading, PageHeader, StatusTag } from '@tutora/ui';
import { api } from '../api';

/** Reads the signed-in user from GET /tutor/me. */
export function AccountPage() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => unwrap<SessionUser & { createdAt: string }>(api.GET('/tutor/me')),
  });
  return (
    <>
      <PageHeader kicker="Your account" title="Account" />
      {me.isPending && <Loading />}
      {me.isError && <Alert tone="danger">{me.error.message}</Alert>}
      {me.data && (
        <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
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
          <Card className="lift-lg">
            <h2 className="text-xl font-extrabold">Also learning?</h2>
            <p className="mt-2 text-sm text-muted">
              Use this same account in the student app to post requests and book tutors.
            </p>
            <a href={APP_URLS.student} className="link mt-4 inline-block text-sm">
              Open Tutora Learn
            </a>
          </Card>
        </div>
      )}
    </>
  );
}
