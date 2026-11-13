/**
 * Public catalog and tutor directory, shared by the student and tutor apps.
 * Imported as `@tutora/core/catalog`; both apps define the same routes:
 * /, /explore, /skills/$slug, /tutors, /tutors/$userId.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { createApiClient, unwrap, type PublicPaths } from '@tutora/api-client';
import {
  Alert,
  Button,
  CoverArt,
  EmptyState,
  Kicker,
  Loading,
  PageHeader,
  Pagination,
  SectionHeader,
  StoryCard,
  Tag,
} from '@tutora/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { API_BASE_URL } from './config';
import type { Category, Page, PublicTutor, Skill, SkillDetail } from './types';

export const publicApi = createApiClient<PublicPaths>({ baseUrl: API_BASE_URL });

const PAGE = 12;

// ---------- data ----------

export function useCategories() {
  return useQuery({
    queryKey: ['public', 'categories'],
    queryFn: () => unwrap<Category[]>(publicApi.GET('/public/categories')),
    staleTime: 5 * 60_000,
  });
}

/** id -> { name, section } where section is the top-level category name. */
export function useCategoryIndex() {
  const { data } = useCategories();
  return useMemo(() => {
    const map = new Map<string, { name: string; section: string; rootId: string }>();
    for (const root of data ?? []) {
      map.set(root.id, { name: root.name, section: root.name, rootId: root.id });
      for (const child of root.children ?? [])
        map.set(child.id, { name: child.name, section: root.name, rootId: root.id });
    }
    return map;
  }, [data]);
}

export function useSkills(params: {
  q?: string;
  categoryId?: string;
  offset?: number;
  limit?: number;
}) {
  const query = {
    limit: params.limit ?? PAGE,
    offset: params.offset ?? 0,
    q: params.q || undefined,
    categoryId: params.categoryId || undefined,
  };
  return useQuery({
    queryKey: ['public', 'skills', query],
    queryFn: () => unwrap<Page<Skill>>(publicApi.GET('/public/skills', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useSkill(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: ['public', 'skill', idOrSlug],
    queryFn: () =>
      unwrap<SkillDetail>(
        publicApi.GET('/public/skills/{idOrSlug}', { params: { path: { idOrSlug: idOrSlug! } } }),
      ),
    enabled: !!idOrSlug,
  });
}

export function useTutors(params: { skillId?: string; offset?: number; limit?: number }) {
  const query = {
    limit: params.limit ?? PAGE,
    offset: params.offset ?? 0,
    skillId: params.skillId || undefined,
  };
  return useQuery({
    queryKey: ['public', 'tutors', query],
    queryFn: () =>
      unwrap<Page<PublicTutor>>(publicApi.GET('/public/tutors', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useTutor(userId: string) {
  return useQuery({
    queryKey: ['public', 'tutor', userId],
    queryFn: () =>
      unwrap<PublicTutor>(
        publicApi.GET('/public/tutors/{userId}', { params: { path: { userId } } }),
      ),
  });
}

// ---------- search params ----------

export interface ExploreSearch {
  q?: string;
  category?: string;
  offset?: number;
}

export function validateExploreSearch(s: Record<string, unknown>): ExploreSearch {
  return {
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    category: typeof s.category === 'string' && s.category ? s.category : undefined,
    offset: typeof s.offset === 'number' && s.offset > 0 ? s.offset : undefined,
  };
}

export interface TutorsSearch {
  skill?: string;
  offset?: number;
}

export function validateTutorsSearch(s: Record<string, unknown>): TutorsSearch {
  return {
    skill: typeof s.skill === 'string' && s.skill ? s.skill : undefined,
    offset: typeof s.offset === 'number' && s.offset > 0 ? s.offset : undefined,
  };
}

// ---------- pieces ----------

function QueryError({ error }: { error: Error }) {
  return (
    <Alert tone="danger" title="Couldn't load this">
      {error.message}
    </Alert>
  );
}

/** "★ 4.8 (12)" or "New" when nobody has rated yet. */
function Rating({ rating }: { rating: PublicTutor['rating'] }) {
  if (!rating || !rating.count || rating.average === null) {
    return <span className="text-xs font-bold text-muted">No ratings yet</span>;
  }
  return (
    <span
      className="text-sm font-bold"
      aria-label={`Rated ${rating.average.toFixed(1)} out of 5 from ${rating.count} reviews`}
    >
      <span className="text-brand" aria-hidden>
        ★
      </span>{' '}
      {rating.average.toFixed(1)} <span className="font-normal text-muted">({rating.count})</span>
    </span>
  );
}

function BadgeTag({ badge }: { badge: PublicTutor['badge'] }) {
  if (badge === 'EXPERT') return <Tag tone="dark">Expert</Tag>;
  if (badge === 'VERIFIED') return <Tag tone="brand">Verified</Tag>;
  return null;
}

function SkillCard({ skill, size = 'md' }: { skill: Skill; size?: 'lg' | 'md' | 'sm' }) {
  const index = useCategoryIndex();
  const cat = index.get(skill.categoryId);
  return (
    <Link to="/skills/$slug" params={{ slug: skill.slug }} className="block h-full">
      <StoryCard
        seed={skill.slug}
        size={size}
        kicker={
          cat ? (cat.section === cat.name ? cat.name : `${cat.section} · ${cat.name}`) : 'Skill'
        }
        title={skill.name}
        dek={skill.description}
        meta={skill.learnerNotice ? 'Read before booking' : 'Live 1:1 and group sessions'}
      />
    </Link>
  );
}

function TutorCard({ tutor }: { tutor: PublicTutor }) {
  return (
    <Link
      to="/tutors/$userId"
      params={{ userId: tutor.userId }}
      className="story flex gap-4 border-t border-border py-4"
    >
      <CoverArt
        seed={tutor.userId}
        label={tutor.fullName}
        ratio="aspect-square"
        className="w-20 shrink-0"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="story-title text-lg font-extrabold leading-tight">{tutor.fullName}</h3>
          <BadgeTag badge={tutor.badge} />
          <Rating rating={tutor.rating} />
        </div>
        {tutor.headline && <p className="mt-1 text-sm text-muted">{tutor.headline}</p>}
        <p className="mt-2 text-xs font-bold text-muted">
          {tutor.skills.map((s) => s.skill.name).join(' · ') || 'No approved skills yet'}
        </p>
      </div>
    </Link>
  );
}

// ---------- pages ----------

/** Front page: lead story, top stories list, sections strip and verified tutors. */
export function FrontPage({ hero }: { hero?: ReactNode }) {
  const skills = useSkills({ limit: 7 });
  const tutors = useTutors({ limit: 4 });
  const categories = useCategories();
  if (skills.isPending) return <Loading />;
  if (skills.isError) return <QueryError error={skills.error} />;
  const [lead, ...rest] = skills.data.items;
  const side = rest.slice(0, 3);
  const grid = rest.slice(3);
  return (
    <div className="flex flex-col gap-14">
      {hero}
      {lead && (
        <section aria-labelledby="lead" className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 id="lead" className="sr-only">
              Featured skill
            </h2>
            <SkillCard skill={lead} size="lg" />
          </div>
          <div className="flex flex-col">
            <SectionHeader title="Top skills" />
            <ol className="flex flex-col">
              {side.map((s, i) => (
                <li key={s.id} className="border-b border-border py-4 first:pt-0">
                  <Link to="/skills/$slug" params={{ slug: s.slug }} className="story flex gap-4">
                    <span className="font-display text-4xl font-extrabold leading-none text-brand">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="story-title text-lg font-extrabold leading-tight">{s.name}</h3>
                      {s.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
            <Link to="/explore" className="link mt-4 self-start text-sm">
              All skills
            </Link>
          </div>
        </section>
      )}

      {categories.data && categories.data.length > 0 && (
        <section aria-labelledby="sections">
          <SectionHeader id="sections" title="Sections" />
          <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
            {categories.data.map((c) => (
              <li key={c.id} className="bg-bg">
                <Link
                  to="/explore"
                  search={{ category: c.id }}
                  className="block h-full p-4 hover:bg-brand hover:text-black"
                >
                  <span className="font-display text-lg font-extrabold leading-tight">
                    {c.name}
                  </span>
                  {c.description && (
                    <span className="mt-1 line-clamp-2 block text-xs opacity-70">
                      {c.description}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grid.length > 0 && (
        <section aria-labelledby="more">
          <SectionHeader
            id="more"
            title="More to learn"
            action={
              <Link to="/explore" className="link">
                See all
              </Link>
            }
          />
          <div className="grid gap-8 sm:grid-cols-3">
            {grid.map((s) => (
              <SkillCard key={s.id} skill={s} size="sm" />
            ))}
          </div>
        </section>
      )}

      {tutors.data && tutors.data.items.length > 0 && (
        <section aria-labelledby="tutors">
          <SectionHeader
            id="tutors"
            title="Verified tutors"
            action={
              <Link to="/tutors" className="link">
                Directory
              </Link>
            }
          />
          <div className="grid gap-x-8 sm:grid-cols-2">
            {tutors.data.items.map((t) => (
              <TutorCard key={t.userId} tutor={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ExplorePage({
  search,
  onSearch,
}: {
  search: ExploreSearch;
  onSearch: (next: ExploreSearch) => void;
}) {
  const categories = useCategories();
  const index = useCategoryIndex();
  const [q, setQ] = useState(search.q ?? '');
  // A top-level category filters to itself; the backend matches skills in its sub-categories too.
  const skills = useSkills({ q: search.q, categoryId: search.category, offset: search.offset });
  const current = search.category ? index.get(search.category) : undefined;

  return (
    <>
      <PageHeader
        kicker="Explore"
        title={
          current ? current.name : search.q ? `Results for “${search.q}”` : 'Every skill on Tutora'
        }
        description="From algebra to candlestick charts to content creation: pick a skill, then post what you want to learn."
      />
      <form
        role="search"
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch({ ...search, q: q.trim() || undefined, offset: undefined });
        }}
      >
        <label htmlFor="skill-search" className="sr-only">
          Search skills
        </label>
        <input
          id="skill-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search skills, e.g. options, video editing, calculus"
          className="w-full border-2 border-text bg-surface px-4 py-3 font-display text-lg outline-none focus:shadow-[0_0_0_3px_var(--color-brand)]"
        />
        <Button type="submit">Search</Button>
      </form>
      <div className="mb-8 flex flex-wrap gap-2" aria-label="Sections">
        <button
          type="button"
          onClick={() => onSearch({ ...search, category: undefined, offset: undefined })}
          aria-pressed={!search.category}
          className={chip(!search.category)}
        >
          All
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={current?.rootId === c.id}
            onClick={() => onSearch({ ...search, category: c.id, offset: undefined })}
            className={chip(current?.rootId === c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      {skills.isPending ? (
        <Loading />
      ) : skills.isError ? (
        <QueryError error={skills.error} />
      ) : skills.data.items.length === 0 ? (
        <EmptyState title="No skills match">
          Try another word, or ask a tutor to suggest it: tutors can propose new skills for review.
        </EmptyState>
      ) : (
        <>
          <p className="mb-4 text-xs font-bold text-muted">
            {skills.data.total} {skills.data.total === 1 ? 'skill' : 'skills'}
          </p>
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {skills.data.items.map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
          <Pagination
            total={skills.data.total}
            limit={skills.data.limit}
            offset={skills.data.offset}
            onChange={(offset) => onSearch({ ...search, offset })}
          />
        </>
      )}
    </>
  );
}

const chip = (active: boolean) =>
  `border-2 px-3 py-1.5 text-xs font-bold ${
    active ? 'border-text bg-text text-bg' : 'border-border hover:border-text'
  }`;

export function SkillPage({
  slug,
  cta,
}: {
  slug: string;
  cta?: (skill: SkillDetail) => ReactNode;
}) {
  const skill = useSkill(slug);
  const tutors = useTutors({ skillId: skill.data?.id, limit: 6 });
  if (skill.isPending) return <Loading />;
  if (skill.isError) return <QueryError error={skill.error} />;
  const s = skill.data;
  return (
    <article className="flex flex-col gap-10">
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Kicker className="mb-3">{s.category.name}</Kicker>
          <h1 className="text-5xl font-extrabold leading-[1.02] md:text-6xl">{s.name}</h1>
          {s.description && (
            <p className="mt-5 font-display text-xl leading-relaxed text-muted">{s.description}</p>
          )}
          {cta && <div className="mt-8 flex flex-wrap gap-3">{cta(s)}</div>}
        </div>
        <CoverArt seed={s.slug} label={s.name} className="lg:col-span-2" />
      </div>
      {s.learnerNotice && (
        <Alert tone="warning" title="Before you book">
          {s.learnerNotice}
        </Alert>
      )}
      {s.topics.length > 0 && (
        <section aria-labelledby="topics">
          <SectionHeader id="topics" title="Topics" />
          <ul className="flex flex-wrap gap-2">
            {s.topics.map((t) => (
              <li
                key={t.id}
                className="border border-border bg-surface px-3 py-2 text-sm font-semibold"
              >
                {t.name}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="who">
        <SectionHeader
          id="who"
          title="Who teaches this"
          action={
            <Link to="/tutors" search={{ skill: s.id }} className="link">
              All tutors
            </Link>
          }
        />
        {tutors.data && tutors.data.items.length > 0 ? (
          <div className="grid gap-x-8 sm:grid-cols-2">
            {tutors.data.items.map((t) => (
              <TutorCard key={t.userId} tutor={t} />
            ))}
          </div>
        ) : tutors.isPending ? (
          <Loading />
        ) : (
          <EmptyState title="No verified tutors yet">
            Post a request anyway: tutors are notified as they get verified.
          </EmptyState>
        )}
      </section>
    </article>
  );
}

export function TutorsPage({
  search,
  onSearch,
}: {
  search: TutorsSearch;
  onSearch: (next: TutorsSearch) => void;
}) {
  const skill = useSkill(search.skill);
  const tutors = useTutors({ skillId: search.skill, offset: search.offset });
  return (
    <>
      <PageHeader
        kicker="Directory"
        title={skill.data ? `Tutors for ${skill.data.name}` : 'Verified tutors'}
        description="Every tutor here was checked by our team, and each skill they list was approved separately."
        actions={
          search.skill ? (
            <Button variant="secondary" onClick={() => onSearch({})}>
              Clear filter
            </Button>
          ) : undefined
        }
      />
      {tutors.isPending ? (
        <Loading />
      ) : tutors.isError ? (
        <QueryError error={tutors.error} />
      ) : tutors.data.items.length === 0 ? (
        <EmptyState title="No tutors found" />
      ) : (
        <>
          <div className="grid gap-x-10 md:grid-cols-2">
            {tutors.data.items.map((t) => (
              <TutorCard key={t.userId} tutor={t} />
            ))}
          </div>
          <Pagination
            total={tutors.data.total}
            limit={tutors.data.limit}
            offset={tutors.data.offset}
            onChange={(offset) => onSearch({ ...search, offset })}
          />
        </>
      )}
    </>
  );
}

export function TutorPage({
  userId,
  actions,
}: {
  userId: string;
  actions?: (tutor: PublicTutor) => ReactNode;
}) {
  const tutor = useTutor(userId);
  if (tutor.isPending) return <Loading />;
  if (tutor.isError) return <QueryError error={tutor.error} />;
  const t = tutor.data;
  return (
    <article className="flex flex-col gap-10">
      <div className="grid items-end gap-8 md:grid-cols-[220px_1fr]">
        <CoverArt seed={t.userId} label={t.fullName} ratio="aspect-square" />
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Kicker>Tutor profile</Kicker>
            <BadgeTag badge={t.badge} />
            <Rating rating={t.rating} />
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.02]">{t.fullName}</h1>
          {t.headline && <p className="mt-3 font-display text-xl text-muted">{t.headline}</p>}
          <p className="mt-4 text-xs font-bold text-muted">
            {[
              t.experienceYears ? `${t.experienceYears} years teaching` : null,
              t.languages.join(', ') || null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {actions && <div className="mt-6 flex flex-wrap gap-2">{actions(t)}</div>}
        </div>
      </div>
      {t.bio && (
        <section aria-labelledby="about">
          <SectionHeader id="about" title="About" />
          <p className="max-w-3xl whitespace-pre-line font-display text-lg leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:text-6xl first-letter:font-extrabold first-letter:leading-none">
            {t.bio}
          </p>
        </section>
      )}
      <section aria-labelledby="teaches">
        <SectionHeader id="teaches" title="Approved skills" />
        <ul className="grid gap-6 md:grid-cols-2">
          {t.skills.map((s) => (
            <li key={s.skill.id} className="border-l-4 border-brand bg-surface p-5">
              <Link
                to="/skills/$slug"
                params={{ slug: s.skill.slug }}
                className="font-display text-xl font-extrabold hover:underline"
              >
                {s.skill.name}
              </Link>
              {s.mastery && (
                <p className="mt-1 text-xs font-bold">
                  Teaching outcomes: <span className="text-text">{s.mastery.label}</span>
                  {s.mastery.score !== null ? ` · ${Math.round(s.mastery.score * 100)}%` : ''}
                </p>
              )}
              {s.experienceYears ? (
                <p className="mt-1 text-xs font-bold text-muted">{s.experienceYears} years</p>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed">{s.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

/** Search-as-you-type skill chooser used by request and tutor-skill forms. */
export function SkillPicker({
  value,
  onChange,
  label = 'Skill',
  error,
}: {
  value: Pick<Skill, 'id' | 'name'> | null;
  onChange: (skill: Skill | null) => void;
  label?: string;
  error?: string;
}) {
  const [q, setQ] = useState('');
  const results = useSkills({ q: q.trim() || undefined, limit: 8 });
  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold">{label}</span>
        <div className="flex items-center justify-between gap-3 border-2 border-text bg-surface px-3 py-2">
          <span className="font-display text-lg font-extrabold">{value.name}</span>
          <Button variant="ghost" onClick={() => onChange(null)}>
            Change
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="skill-picker" className="text-xs font-bold">
        {label}
      </label>
      <input
        id="skill-picker"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type to search skills"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'skill-picker-error' : undefined}
        className={`border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text focus:shadow-[0_0_0_3px_var(--color-brand)] ${error ? 'border-danger' : 'border-border'}`}
      />
      {error && (
        <p id="skill-picker-error" role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <ul
        aria-label="Matching skills"
        className="max-h-64 overflow-y-auto border border-border bg-surface"
      >
        {results.data?.items.map((s) => (
          <li key={s.id} className="border-b border-border last:border-0">
            <button
              type="button"
              onClick={() => onChange(s)}
              className="block w-full px-3 py-2 text-left hover:bg-brand hover:text-black"
            >
              <span className="font-semibold">{s.name}</span>
              {s.description && (
                <span className="block truncate text-xs opacity-70">{s.description}</span>
              )}
            </button>
          </li>
        ))}
        {results.data && results.data.items.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted">No skills match “{q}”.</li>
        )}
      </ul>
    </div>
  );
}
