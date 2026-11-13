import { ApiError } from '@tutora/api-client';
import { describeAuthError, rupeesToPaise, type LearningRequest, type Level } from '@tutora/core';
import { SkillPicker, useSkill } from '@tutora/core/catalog';
import { Alert, Button, Field, Select, Textarea } from '@tutora/ui';
import { useState, type FormEvent } from 'react';

export interface RequestBody {
  skillId: string;
  topicId?: string;
  level: Level;
  title: string;
  description: string;
  preferredLanguage?: string;
  budgetHintPaise?: number;
}

type Errors = Partial<
  Record<'skill' | 'title' | 'description' | 'budget' | 'level' | 'topic' | 'language', string>
>;

const LEVELS: Array<[Level, string]> = [
  ['BEGINNER', 'Beginner: starting from scratch'],
  ['INTERMEDIATE', 'Intermediate: know the basics'],
  ['ADVANCED', 'Advanced: going deep'],
];

/** Create/edit form for a learning request. Validation mirrors the backend; server field errors win. */
export function RequestForm({
  initial,
  initialSkill,
  mode,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: LearningRequest;
  initialSkill?: { id: string; name: string } | null;
  mode: 'create' | 'edit';
  submitting: boolean;
  error: unknown;
  onSubmit: (body: RequestBody, publish: boolean) => void;
  onCancel?: () => void;
}) {
  const [skill, setSkill] = useState<{ id: string; name: string } | null>(
    initial ? { id: initial.skill.id, name: initial.skill.name } : (initialSkill ?? null),
  );
  const detail = useSkill(skill?.id);
  const [topicId, setTopicId] = useState(initial?.topicId ?? '');
  const [level, setLevel] = useState<Level>(initial?.level ?? 'BEGINNER');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [language, setLanguage] = useState(initial?.preferredLanguage ?? '');
  const [budget, setBudget] = useState(
    initial?.budgetHintPaise ? String(initial.budgetHintPaise / 100) : '',
  );
  const [errors, setErrors] = useState<Errors>({});

  const server = error instanceof ApiError ? error.fieldErrors : {};
  const fieldError = (key: keyof Errors, ...serverKeys: string[]) =>
    errors[key] ?? serverKeys.map((k) => server[k]?.[0]).find(Boolean);
  const formError =
    error && !(error instanceof ApiError && error.code === 'VALIDATION_FAILED')
      ? describeAuthError(error)
      : null;

  const submit = (publish: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    const next: Errors = {};
    if (!skill) next.skill = 'Choose the skill you want to learn.';
    if (title.trim().length < 5) next.title = 'Give it a short headline (at least 5 characters).';
    if (description.trim().length < 10)
      next.description = 'Describe what you want to learn (at least 10 characters).';
    const paise = rupeesToPaise(budget);
    if (Number.isNaN(paise) || (paise !== undefined && paise < 100))
      next.budget = 'Enter at least ₹1, like 500 or 499.50.';
    setErrors(next);
    if (Object.keys(next).length || !skill) return;
    onSubmit(
      {
        skillId: skill.id,
        topicId: topicId || undefined,
        level,
        title: title.trim(),
        description: description.trim(),
        preferredLanguage: language.trim() || undefined,
        budgetHintPaise: paise,
      },
      publish,
    );
  };

  return (
    <form onSubmit={submit(mode === 'create')} noValidate className="flex flex-col gap-6">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <SkillPicker
        value={skill}
        onChange={(s) => {
          setSkill(s);
          setTopicId('');
        }}
        label="What do you want to learn?"
        error={fieldError('skill', 'skillId')}
      />
      {detail.data?.learnerNotice && (
        <Alert tone="warning" title="About this skill">
          {detail.data.learnerNotice}
        </Alert>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Select
          label="Topic (optional)"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          disabled={!detail.data?.topics.length}
          error={fieldError('topic', 'topicId')}
        >
          <option value="">Any topic</option>
          {detail.data?.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          label="Your level"
          value={level}
          onChange={(e) => setLevel(e.target.value as Level)}
          error={fieldError('level', 'level')}
        >
          {LEVELS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <Field
        label="Headline"
        value={title}
        maxLength={140}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Read candlestick charts with confidence"
        error={fieldError('title', 'title')}
      />
      <Textarea
        label="What should the tutor know?"
        rows={6}
        value={description}
        maxLength={4000}
        onChange={(e) => setDescription(e.target.value)}
        hint="Goals, what you already know, when you're free. Phone numbers, emails and links are hidden automatically so every payment stays protected."
        error={fieldError('description', 'description')}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="Preferred language (optional)"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="English, Hindi…"
          error={fieldError('language', 'preferredLanguage')}
        />
        <Field
          label="Budget per session, ₹ (optional)"
          inputMode="decimal"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="500"
          hint="A hint for tutors. You still compare bids before paying."
          error={fieldError('budget', 'budgetHintPaise')}
        />
      </div>
      <div className="flex flex-wrap gap-3 border-t-2 border-dashed border-border pt-6">
        {mode === 'create' ? (
          <>
            <Button type="submit" loading={submitting}>
              Publish request
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => submit(false)()}>
              Save as draft
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" loading={submitting}>
              Save changes
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
