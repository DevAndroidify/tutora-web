import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { unwrap } from '@tutora/api-client';
import type { LearningRequest } from '@tutora/core';
import { useSkill } from '@tutora/core/catalog';
import { Loading, PageHeader } from '@tutora/ui';
import { api } from '../api';
import { RequestForm, type RequestBody } from './RequestForm';

export function NewRequestPage({ skillSlug }: { skillSlug?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const preset = useSkill(skillSlug);
  const create = useMutation({
    mutationFn: async ({ body, publish }: { body: RequestBody; publish: boolean }) => {
      const draft = await unwrap<LearningRequest>(api.POST('/student/requests', { body }));
      if (!publish) return draft;
      return unwrap<LearningRequest>(
        api.POST('/student/requests/{id}/publish', { params: { path: { id: draft.id } } }),
      );
    },
    onSuccess: async (req) => {
      await qc.invalidateQueries({ queryKey: ['requests'] });
      qc.setQueryData(['request', req.id], req);
      await navigate({ to: '/requests/$id', params: { id: req.id } });
    },
  });
  if (skillSlug && preset.isPending) return <Loading />;
  return (
    <>
      <PageHeader
        kicker="New request"
        title="What do you want to learn?"
        description="Tutors who teach this see your question and send sealed offers. Nobody sees anyone else's price."
      />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="lift-lg rounded-[var(--radius-card)] border-2 border-ink bg-surface p-6 md:p-8">
          <RequestForm
            mode="create"
            initialSkill={preset.data ? { id: preset.data.id, name: preset.data.name } : null}
            submitting={create.isPending}
            error={create.error}
            onSubmit={(body, publish) => create.mutate({ body, publish })}
          />
        </div>
        <aside className="rounded-[var(--radius-card)] border-2 border-ink bg-mint p-6">
          <h2 className="text-xl font-extrabold">Questions that get better offers</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
            <li>Say what you already know, not just what you don&apos;t.</li>
            <li>Name a goal or a date, like an exam in March.</li>
            <li>Mention when you&apos;re free, so offers fit your day.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
