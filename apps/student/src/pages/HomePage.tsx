import { useSession } from '@tutora/core';
import { Card, PageHeader } from '@tutora/ui';

export function HomePage() {
  const session = useSession();
  const name = session.status === 'signedIn' ? session.user.fullName.split(' ')[0] : '';
  return (
    <>
      <PageHeader
        title={`Welcome, ${name}`}
        description="Find a tutor for any skill: post what you want to learn, compare sealed bids and book a live session."
      />
      <Card>
        <h2 className="font-medium">Coming next</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Browse skills and tutors (Phase 2)</li>
          <li>Post learning requests (Phase 6)</li>
          <li>Compare bids and pay (Phase 8)</li>
          <li>Live sessions and replays (Phases 10-11)</li>
        </ul>
      </Card>
    </>
  );
}
