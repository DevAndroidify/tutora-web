import { useSession } from '@tutora/core';
import { Card, PageHeader } from '@tutora/ui';

export function HomePage() {
  const session = useSession();
  const name = session.status === 'signedIn' ? session.user.fullName.split(' ')[0] : '';
  return (
    <>
      <PageHeader
        title={`Welcome, ${name}`}
        description="Teach what you know: get verified for your skills, bid on learner requests and run live sessions."
      />
      <Card>
        <h2 className="font-medium">Coming next</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Tutor profile and skill verification (Phase 3)</li>
          <li>Browse requests and bid (Phase 7)</li>
          <li>Live sessions (Phase 10)</li>
          <li>Earnings (Phase 12)</li>
        </ul>
      </Card>
    </>
  );
}
