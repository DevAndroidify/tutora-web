import { Link } from '@tanstack/react-router';
import { useSession } from '@tutora/core';
import { FrontPage } from '@tutora/core/catalog';
import { buttonClass } from '@tutora/ui';

const STEPS = [
  ['Ask', 'Say what you are stuck on, your level and when you are free. Posting is free.'],
  ['Get sealed offers', 'Verified tutors send a price, a start time and how they would teach it.'],
  ['Pick one', 'Offers are ranked by learner results, start time, reliability and price.'],
  [
    'Learn live',
    'Video, audio only or just the whiteboard. Your payment is held until the class is done.',
  ],
] as const;

/** Example offers in the hero, so first-time visitors see what they will get. */
const EXAMPLE = [
  ['Ananya', 'Today, 6:30 pm', '₹450', true],
  ['Rahul', 'Tomorrow, 7 pm', '₹350', false],
  ['Dev', 'Sat, 10 am', '₹600', false],
] as const;

/** Front page: what Tutora does, how it works, then the live catalog. */
export function HomePage() {
  const session = useSession();
  const name = session.status === 'signedIn' ? session.user.fullName.split(' ')[0] : null;
  return (
    <FrontPage
      hero={
        <>
          <section className="grid items-center gap-10 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <p className="mb-3 text-[15px] font-bold text-muted">
                {name ? `Welcome back, ${name}` : 'Live tutoring, on your terms'}
              </p>
              <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.02] md:text-6xl">
                Stuck on something? <span className="mark">Tutors will compete</span> to teach you.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                Post your question. Verified tutors send sealed offers. You pick the best one and
                meet live in your browser.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/requests/new" className={buttonClass('primary', 'min-h-13 px-6')}>
                  Ask a question
                </Link>
                <Link to="/explore" className={buttonClass('secondary', 'min-h-13 px-6')}>
                  Browse skills
                </Link>
              </div>
            </div>
            <figure
              aria-label="Example: three offers for a calculus question"
              className="lift-lg rounded-[var(--radius-card)] border-2 border-ink bg-surface p-5"
            >
              <figcaption className="flex items-center justify-between gap-3 border-b-2 border-dashed border-border pb-3">
                <span className="font-display text-lg font-extrabold">Integration by parts</span>
                <span className="text-sm text-muted">3 offers · example</span>
              </figcaption>
              <ul className="mt-3 flex flex-col gap-2.5">
                {EXAMPLE.map(([who, when, price, best]) => (
                  <li
                    key={who}
                    className={`flex items-center gap-3 rounded-[14px] border-2 border-ink px-3.5 py-3 ${best ? 'bg-brand text-[#16161a]' : 'bg-surface'}`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-surface font-bold text-text">
                      {who[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{who}</span>
                      <span className="block text-sm opacity-80">{when}</span>
                    </span>
                    {best && (
                      <span className="rounded-full border-2 border-ink bg-surface px-2 py-0.5 text-xs font-bold text-text">
                        Best match
                      </span>
                    )}
                    <span className="font-display text-xl font-extrabold">{price}</span>
                  </li>
                ))}
              </ul>
            </figure>
          </section>
          <section aria-labelledby="how">
            <h2 id="how" className="mb-5 text-2xl font-extrabold">
              How it works
            </h2>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(([title, body], i) => (
                <li
                  key={title}
                  className="rounded-[var(--radius-card)] border-2 border-ink bg-surface p-5"
                >
                  <span className="grid size-9 place-items-center rounded-full border-2 border-ink bg-brand font-bold text-[#16161a]">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-extrabold">{title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </section>
        </>
      }
    />
  );
}
