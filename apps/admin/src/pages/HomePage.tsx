import { useSession } from '@tutora/core';
import { Card, PageHeader } from '@tutora/ui';

export function HomePage() {
  const session = useSession();
  const name = session.status === 'signedIn' ? session.user.fullName.split(' ')[0] : '';
  return (
    <>
      <PageHeader
        title={`Welcome, ${name}`}
        description="Staff portal for verification, the skill catalog, trust & safety and money."
      />
      <Card>
        <h2 className="font-medium">Coming next</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Tutor and skill verification queues (Phase 4)</li>
          <li>Trust & safety cases (Phase 5)</li>
          <li>Disputes, payouts and reconciliation (Phase 12)</li>
        </ul>
      </Card>
    </>
  );
}
