import { Link } from '@tanstack/react-router';
import { useSession } from '@tutora/core';
import { PageHeader, SectionHeader, Stat } from '@tutora/ui';
import { useCases, useProfileReviews, useSkillReviews, useSuggestions } from '../queries';

const count = (q: { data?: unknown[]; isPending: boolean }) =>
  q.isPending ? '…' : (q.data?.length ?? '—');

export function DeskPage() {
  const session = useSession();
  const profiles = useProfileReviews('PENDING');
  const skills = useSkillReviews('PENDING');
  const suggestions = useSuggestions('PENDING');
  const cases = useCases('OPEN');
  const urgent = (cases.data ?? []).filter((c) => c.priority >= 7).length;
  return (
    <>
      <PageHeader
        kicker="Today's desk"
        title="What needs a decision"
        description={
          session.status === 'signedIn' ? `Signed in as ${session.user.fullName}.` : undefined
        }
      />
      <section aria-labelledby="queues">
        <SectionHeader id="queues" title="Queues" />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/verification" className="hover:bg-surface">
            <Stat label="Tutor profiles to verify" value={count(profiles)} />
          </Link>
          <Link to="/verification" className="hover:bg-surface">
            <Stat label="Skill claims to review" value={count(skills)} />
          </Link>
          <Link to="/catalog/suggestions" className="hover:bg-surface">
            <Stat label="Skill suggestions" value={count(suggestions)} />
          </Link>
          <Link to="/cases" className="hover:bg-surface">
            <Stat
              label="Open safety cases"
              value={count(cases)}
              hint={
                urgent ? (
                  <span className="font-bold text-danger">{urgent} high priority</span>
                ) : undefined
              }
            />
          </Link>
        </div>
      </section>
    </>
  );
}
