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
        description="Tutors verified for this skill see your request and send sealed bids. Nobody sees anyone else's price."
      />
      <div className="max-w-3xl">
        <RequestForm
          mode="create"
          initialSkill={preset.data ? { id: preset.data.id, name: preset.data.name } : null}
          submitting={create.isPending}
          error={create.error}
          onSubmit={(body, publish) => create.mutate({ body, publish })}
        />
      </div>
    </>
  );
}
