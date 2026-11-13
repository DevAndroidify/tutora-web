import { Link } from '@tanstack/react-router';
import { useSession } from '@tutora/core';
import { FrontPage } from '@tutora/core/catalog';
import { buttonClass } from '@tutora/ui';

/** Front page: an editorial hero over the live catalog. */
export function HomePage() {
  const session = useSession();
  const name = session.status === 'signedIn' ? session.user.fullName.split(' ')[0] : null;
  return (
    <FrontPage
      hero={
        <section className="grid gap-6 border-b-4 border-text pb-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="mb-3 text-xs font-bold text-muted">
              <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 bg-brand" />
              {name ? `Welcome back, ${name}` : 'The learning marketplace'}
            </p>
            <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.98] md:text-7xl">
              Learn anything from people who have done it.
            </h1>
            <p className="mt-5 max-w-2xl font-display text-xl leading-relaxed text-muted">
              Say what you want to learn. Verified tutors send sealed bids. You pick one and meet
              live.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/requests/new" className={buttonClass('primary', 'px-6 py-4')}>
              Post a request
            </Link>
            <Link to="/explore" className={buttonClass('secondary', 'px-6 py-4')}>
              Explore skills
            </Link>
          </div>
        </section>
      }
    />
  );
}
