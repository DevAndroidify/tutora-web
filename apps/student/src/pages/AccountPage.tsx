import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import { APP_URLS, formatDate, humanize, type SessionUser } from '@tutora/core';
import { Alert, Card, Facts, Loading, PageHeader, StatusTag } from '@tutora/ui';
import { api } from '../api';

/** Reads the signed-in user from GET /student/me. */
export function AccountPage() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => unwrap<SessionUser & { createdAt: string }>(api.GET('/student/me')),
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
          <Card className="border-t-8 border-t-brand">
            <h2 className="text-xl font-black">Want to teach?</h2>
            <p className="mt-2 text-sm text-muted">
              Use this same account in the tutor app to build a profile and get verified.
            </p>
            <a href={APP_URLS.tutor} className="link mt-4 inline-block text-sm">
              Open Tutora Teach
            </a>
          </Card>
        </div>
      )}
    </>
  );
}
