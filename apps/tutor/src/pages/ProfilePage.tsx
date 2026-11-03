import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, unwrap } from '@tutora/api-client';
import {
  describeAuthError,
  formatDate,
  type SkillSuggestion,
  type TutorProfile,
  type TutorSkillClaim,
} from '@tutora/core';
import { SkillPicker, useCategories, useSkill } from '@tutora/core/catalog';
import {
  Alert,
  Button,
  Card,
  Field,
  Loading,
  PageHeader,
  SectionHeader,
  Select,
  StatusTag,
  Textarea,
} from '@tutora/ui';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useMyProfile } from '../profile';

const fieldErr = (err: unknown, key: string) =>
  err instanceof ApiError ? err.fieldErrors[key]?.[0] : undefined;
const topError = (err: unknown) =>
  err && !(err instanceof ApiError && err.code === 'VALIDATION_FAILED')
    ? describeAuthError(err)
    : null;

export function ProfilePage({ addSkillSlug }: { addSkillSlug?: string }) {
  const profile = useMyProfile();
  if (profile.isPending) return <Loading />;
  if (profile.isError) return <Alert tone="danger">{profile.error.message}</Alert>;
  const p = profile.data;
  return (
    <>
      <PageHeader
        kicker="Profile & skills"
        title={p ? 'Your tutor profile' : 'Create your tutor profile'}
        description="Learners see your headline, bio and approved skills. Your payout UPI ID stays private."
      />
      <div className="flex flex-col gap-14">
        <VerificationBanner profile={p} />
        <ProfileForm profile={p} />
        <SkillsSection profile={p} addSkillSlug={addSkillSlug} />
        <SuggestionsSection />
      </div>
    </>
  );
}

function VerificationBanner({ profile }: { profile: TutorProfile | null }) {
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: () => unwrap<TutorProfile>(api.POST('/tutor/profile/verification')),
    onSuccess: (p) => qc.setQueryData(['tutor', 'profile'], p),
  });
  const status = profile?.verificationStatus ?? 'NOT_SUBMITTED';
  const missing =
    submit.error instanceof ApiError && submit.error.code === 'PROFILE_INCOMPLETE'
      ? (submit.error.details.missing as string[] | undefined)
      : undefined;
  return (
    <section aria-labelledby="verification" className="border-l-8 border-brand bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 id="verification" className="text-2xl font-black">
              Verification
            </h2>
            <StatusTag status={status} />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {status === 'NOT_SUBMITTED' &&
              'When your profile and at least one skill are ready, send them to our team.'}
            {status === 'PENDING' &&
              `Submitted ${formatDate(profile?.verificationSubmittedAt)}. Our team checks your profile and each skill's evidence.`}
            {status === 'VERIFIED' &&
              `Verified ${formatDate(profile?.verificationDecidedAt)}. New skills you add are reviewed one by one.`}
            {status === 'REJECTED' &&
              'Not approved yet. Update your profile using the note below, then submit again.'}
          </p>
        </div>
        {(status === 'NOT_SUBMITTED' || status === 'REJECTED') && (
          <Button loading={submit.isPending} disabled={!profile} onClick={() => submit.mutate()}>
            Submit for review
          </Button>
        )}
      </div>
      {status === 'REJECTED' && profile?.verificationRejectionReason && (
        <div className="mt-4">
          <Alert tone="danger" title="Reviewer's note">
            {profile.verificationRejectionReason}
          </Alert>
        </div>
      )}
      {submit.error && (
        <div className="mt-4">
          <Alert tone="danger" title={missing ? 'Almost there. Still missing:' : undefined}>
            {missing ? (
              <ul className="list-disc pl-5">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              describeAuthError(submit.error)
            )}
          </Alert>
        </div>
      )}
    </section>
  );
}

function ProfileForm({ profile }: { profile: TutorProfile | null }) {
  const qc = useQueryClient();
  const [headline, setHeadline] = useState(profile?.headline ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [years, setYears] = useState(profile?.experienceYears?.toString() ?? '');
  const [languages, setLanguages] = useState(profile?.languages.join(', ') ?? '');
  const [upi, setUpi] = useState(profile?.payoutUpiId ?? '');
  const save = useMutation({
    mutationFn: () =>
      unwrap<TutorProfile>(
        api.PUT('/tutor/profile', {
          body: {
            headline: headline.trim() || undefined,
            bio: bio.trim() || undefined,
            experienceYears: years.trim() ? Number(years) : undefined,
            languages: languages
              .split(',')
              .map((l) => l.trim())
              .filter(Boolean),
            payoutUpiId: upi.trim() || undefined,
          },
        }),
      ),
    onSuccess: (p) => qc.setQueryData(['tutor', 'profile'], p),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const err = save.error;
  return (
    <section aria-labelledby="about">
      <SectionHeader id="about" title="About you" />
      <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-6">
        {topError(err) && <Alert tone="danger">{topError(err)}</Alert>}
        {save.isSuccess && <Alert tone="success">Profile saved.</Alert>}
        <Field
          label="Headline"
          value={headline}
          maxLength={120}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Chartered accountant teaching personal finance"
          error={fieldErr(err, 'headline')}
        />
        <Textarea
          label="Bio"
          rows={6}
          value={bio}
          maxLength={2000}
          onChange={(e) => setBio(e.target.value)}
          hint="At least 30 characters before you can submit for review. Your experience, how you teach, who you teach best."
          error={fieldErr(err, 'bio')}
        />
        <div className="grid gap-6 md:grid-cols-3">
          <Field
            label="Years teaching"
            type="number"
            min={0}
            max={60}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            error={fieldErr(err, 'experienceYears')}
          />
          <Field
            label="Languages"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            hint="Comma separated, e.g. English, Hindi"
            error={fieldErr(err, 'languages')}
            className="md:col-span-2"
          />
        </div>
        <Field
          label="Payout UPI ID"
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          placeholder="name@bank"
          hint="Private. Used only to pay out your earnings."
          error={fieldErr(err, 'payoutUpiId')}
        />
        <div>
          <Button type="submit" loading={save.isPending}>
            {profile ? 'Save profile' : 'Create profile'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function SkillsSection({
  profile,
  addSkillSlug,
}: {
  profile: TutorProfile | null;
  addSkillSlug?: string;
}) {
  const preset = useSkill(addSkillSlug);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    claim?: TutorSkillClaim;
  } | null>(null);
  const [adding, setAdding] = useState(!!addSkillSlug);
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (skillId: string) =>
      unwrap<TutorProfile>(
        api.DELETE('/tutor/skills/{skillId}', { params: { path: { skillId } } }),
      ),
    onSuccess: (p) => qc.setQueryData(['tutor', 'profile'], p),
  });
  const presetSkill =
    adding && preset.data && !profile?.skills.some((s) => s.skill.id === preset.data.id)
      ? { id: preset.data.id, name: preset.data.name }
      : null;

  return (
    <section aria-labelledby="skills">
      <SectionHeader
        id="skills"
        title="Skills you teach"
        action={
          profile && !adding && !editing ? (
            <Button variant="ghost" onClick={() => setAdding(true)}>
              + Add a skill
            </Button>
          ) : undefined
        }
      />
      {!profile && (
        <p className="text-sm text-muted">
          Create your profile first, then list the skills you teach.
        </p>
      )}
      {remove.error && <Alert tone="danger">{describeAuthError(remove.error)}</Alert>}
      {profile && profile.skills.length === 0 && !adding && (
        <p className="text-sm text-muted">
          No skills yet. Each skill is reviewed on its own, with your evidence.
        </p>
      )}
      <ul className="grid gap-6 md:grid-cols-2">
        {profile?.skills.map((c) =>
          editing?.id === c.skill.id ? null : (
            <li key={c.skill.id} className="flex flex-col border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-black">{c.skill.name}</h3>
                <StatusTag status={c.status} />
              </div>
              <p className="mt-2 text-sm leading-relaxed">{c.summary}</p>
              {c.evidenceLinks.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 text-xs">
                  {c.evidenceLinks.map((l) => (
                    <li key={l} className="truncate">
                      <a href={l} target="_blank" rel="noopener noreferrer" className="link">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {c.status === 'REJECTED' && c.rejectionReason && (
                <div className="mt-3">
                  <Alert tone="danger" title="Reviewer's note">
                    {c.rejectionReason}
                  </Alert>
                </div>
              )}
              <div className="mt-auto flex gap-2 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setEditing({ id: c.skill.id, name: c.skill.name, claim: c })}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  loading={remove.isPending && remove.variables === c.skill.id}
                  onClick={() => {
                    if (window.confirm(`Remove ${c.skill.name} from your skills?`))
                      remove.mutate(c.skill.id);
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
      {(adding || editing) && profile && (
        <Card className="mt-8 max-w-3xl border-t-8 border-t-brand">
          <h3 className="mb-5 text-2xl font-black">
            {editing ? `Edit ${editing.name}` : 'Add a skill'}
          </h3>
          <ClaimForm
            key={editing?.id ?? presetSkill?.id ?? 'new'}
            skill={editing ?? presetSkill}
            claim={editing?.claim}
            onDone={() => {
              setAdding(false);
              setEditing(null);
            }}
          />
        </Card>
      )}
    </section>
  );
}

function ClaimForm({
  skill: initialSkill,
  claim,
  onDone,
}: {
  skill: { id: string; name: string } | null;
  claim?: TutorSkillClaim;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [skill, setSkill] = useState(initialSkill);
  const [summary, setSummary] = useState(claim?.summary ?? '');
  const [years, setYears] = useState(claim?.experienceYears?.toString() ?? '');
  const [links, setLinks] = useState(claim?.evidenceLinks.join('\n') ?? '');
  const [local, setLocal] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (skillId: string) =>
      unwrap<TutorProfile>(
        api.PUT('/tutor/skills/{skillId}', {
          params: { path: { skillId } },
          body: {
            summary: summary.trim(),
            experienceYears: years.trim() ? Number(years) : undefined,
            evidenceLinks: links
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean),
          },
        }),
      ),
    onSuccess: (p) => {
      qc.setQueryData(['tutor', 'profile'], p);
      onDone();
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const list = links
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!skill) next.skill = 'Choose a skill.';
    if (summary.trim().length < 20)
      next.summary = 'Write at least 20 characters about how you teach this.';
    if (list.length > 5) next.links = 'Add up to 5 links.';
    else if (list.some((l) => !/^https:\/\/\S+$/.test(l)))
      next.links = 'Each link must start with https://';
    setLocal(next);
    if (!Object.keys(next).length && skill) save.mutate(skill.id);
  };
  const err = save.error;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {topError(err) && <Alert tone="danger">{topError(err)}</Alert>}
      {claim ? null : (
        <SkillPicker value={skill} onChange={setSkill} label="Skill" error={local.skill} />
      )}
      <Textarea
        label="How you teach it"
        rows={4}
        value={summary}
        maxLength={1000}
        onChange={(e) => setSummary(e.target.value)}
        hint="What learners will be able to do after your sessions. No guaranteed returns or tips."
        error={local.summary ?? fieldErr(err, 'summary')}
      />
      <Field
        label="Years with this skill (optional)"
        type="number"
        min={0}
        max={60}
        value={years}
        onChange={(e) => setYears(e.target.value)}
        error={fieldErr(err, 'experienceYears')}
      />
      <Textarea
        label="Evidence links"
        rows={3}
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        hint="One per line, https only: certificates, portfolio, published work. Up to 5."
        error={local.links ?? fieldErr(err, 'evidenceLinks')}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          {claim ? 'Save and resubmit' : 'Add skill for review'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SuggestionsSection() {
  const qc = useQueryClient();
  const categories = useCategories();
  const list = useQuery({
    queryKey: ['tutor', 'suggestions'],
    queryFn: () => unwrap<SkillSuggestion[]>(api.GET('/tutor/skill-suggestions')),
  });
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const suggest = useMutation({
    mutationFn: () =>
      unwrap<SkillSuggestion>(
        api.POST('/tutor/skill-suggestions', {
          body: { categoryId, name: name.trim(), description: description.trim() || undefined },
        }),
      ),
    onSuccess: () => {
      setName('');
      setDescription('');
      void qc.invalidateQueries({ queryKey: ['tutor', 'suggestions'] });
    },
  });
  const options = (categories.data ?? []).flatMap((c) => [c, ...(c.children ?? [])]);
  const err = suggest.error;
  return (
    <section aria-labelledby="suggest">
      <SectionHeader id="suggest" title="Missing a skill?" />
      <div className="grid gap-10 lg:grid-cols-2">
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            suggest.mutate();
          }}
        >
          <p className="text-sm text-muted">
            Suggest it. Our catalog team adds skills that are teachable and safe.
          </p>
          {topError(err) && <Alert tone="danger">{topError(err)}</Alert>}
          {suggest.isSuccess && (
            <Alert tone="success">Thanks, your suggestion is in the queue.</Alert>
          )}
          <Select
            label="Section"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            error={fieldErr(err, 'categoryId')}
          >
            <option value="">Choose a section</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `— ${c.name}` : c.name}
              </option>
            ))}
          </Select>
          <Field
            label="Skill name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            error={fieldErr(err, 'name')}
          />
          <Textarea
            label="What it covers (optional)"
            rows={3}
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            error={fieldErr(err, 'description')}
          />
          <div>
            <Button
              type="submit"
              variant="secondary"
              loading={suggest.isPending}
              disabled={!categoryId || name.trim().length < 2}
            >
              Suggest skill
            </Button>
          </div>
        </form>
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Your suggestions
          </h3>
          {list.data && list.data.length > 0 ? (
            <ul>
              {list.data.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 border-t border-border py-3"
                >
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    {s.decisionNote && <p className="text-xs text-muted">{s.decisionNote}</p>}
                  </div>
                  <StatusTag status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">None yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
