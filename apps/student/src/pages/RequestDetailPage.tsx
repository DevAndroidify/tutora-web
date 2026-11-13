import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError, unwrap } from '@tutora/api-client';
import {
  describeAuthError,
  formatDateTime,
  formatINR,
  humanize,
  timeFromNow,
  type LearningRequest,
  type Presign,
} from '@tutora/core';
import { useSkill } from '@tutora/core/catalog';
import { Alert, Button, Card, Facts, Kicker, Loading, SectionHeader, StatusTag } from '@tutora/ui';
import { useRef, useState } from 'react';
import { api } from '../api';
import { BidsSection } from './BidsSection';
import { RequestForm, type RequestBody } from './RequestForm';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FILE_TYPES = 'application/pdf,image/png,image/jpeg';

export function RequestDetailPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const request = useQuery({
    queryKey: ['request', id],
    queryFn: () =>
      unwrap<LearningRequest>(api.GET('/student/requests/{id}', { params: { path: { id } } })),
  });
  const skill = useSkill(request.data?.skill.slug);

  const done = (r: LearningRequest) => {
    qc.setQueryData(['request', id], r);
    void qc.invalidateQueries({ queryKey: ['requests'] });
  };
  const update = useMutation({
    mutationFn: (body: RequestBody) =>
      unwrap<LearningRequest>(
        api.PATCH('/student/requests/{id}', { params: { path: { id } }, body }),
      ),
    onSuccess: (r) => {
      done(r);
      setEditing(false);
    },
  });
  const publish = useMutation({
    mutationFn: () =>
      unwrap<LearningRequest>(
        api.POST('/student/requests/{id}/publish', { params: { path: { id } } }),
      ),
    onSuccess: done,
  });
  const cancel = useMutation({
    mutationFn: () =>
      unwrap<LearningRequest>(
        api.POST('/student/requests/{id}/cancel', { params: { path: { id } } }),
      ),
    onSuccess: done,
  });

  if (request.isPending) return <Loading />;
  if (request.isError) {
    return (
      <Alert tone="danger" title="Couldn't open this request">
        {request.error.message}{' '}
        <Link to="/requests" className="link">
          Back to my requests
        </Link>
      </Alert>
    );
  }
  const r = request.data;
  const actionError = publish.error ?? cancel.error;
  const canEdit = r.status === 'DRAFT';
  const canCancel = r.status === 'DRAFT' || r.status === 'OPEN';
  const topic = skill.data?.topics.find((t) => t.id === r.topicId);

  return (
    <article className="flex flex-col gap-10">
      <header>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Kicker>{r.skill.name}</Kicker>
          <StatusTag status={r.status} />
        </div>
        <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] md:text-5xl">{r.title}</h1>
        {r.status === 'OPEN' && r.expiresAt && (
          <p className="mt-3 text-sm font-semibold text-muted">
            Taking offers · closes {timeFromNow(r.expiresAt)}
          </p>
        )}
        {(canEdit || canCancel) && !editing && (
          <div className="mt-6 flex flex-wrap gap-2">
            {canEdit && (
              <Button loading={publish.isPending} onClick={() => publish.mutate()}>
                Publish to tutors
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {canCancel && (
              <Button
                variant="ghost"
                loading={cancel.isPending}
                onClick={() => {
                  if (window.confirm('Cancel this request? Tutors will no longer see it.'))
                    cancel.mutate();
                }}
              >
                Cancel request
              </Button>
            )}
          </div>
        )}
        {actionError && (
          <div className="mt-4">
            <Alert tone="danger">{describeAuthError(actionError)}</Alert>
          </div>
        )}
      </header>

      {!editing && r.status !== 'DRAFT' && r.status !== 'POOLED' && <BidsSection request={r} />}

      {editing ? (
        <div className="max-w-3xl">
          <RequestForm
            mode="edit"
            initial={r}
            submitting={update.isPending}
            error={update.error}
            onSubmit={(body) => update.mutate(body)}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-8">
            {r.skill.learnerNotice && (
              <Alert tone="warning" title="About this skill">
                {r.skill.learnerNotice}
              </Alert>
            )}
            <section aria-labelledby="brief">
              <SectionHeader id="brief" title="Your question" />
              <p className="whitespace-pre-line text-[17px] leading-relaxed">{r.description}</p>
              {r.description.includes('[hidden]') && (
                <p className="mt-3 text-xs text-muted">
                  Contact details were hidden. Talk and pay through Tutora so your money stays
                  protected.
                </p>
              )}
            </section>
            <Attachments request={r} onChange={done} />
          </div>
          <aside className="flex flex-col gap-8">
            <Card>
              <Facts
                items={[
                  ['Level', humanize(r.level)],
                  ['Topic', topic?.name ?? 'Any'],
                  ['Budget', formatINR(r.budgetHintPaise)],
                  ['Language', r.preferredLanguage ?? 'Any'],
                  ['Published', formatDateTime(r.publishedAt)],
                  ['Closes', formatDateTime(r.expiresAt)],
                ]}
              />
            </Card>
          </aside>
        </div>
      )}
      {r.status === 'POOLED' && (
        <Alert tone="info" title="You're in a group for this request">
          Tutors bid on the group instead, usually at a lower price per seat.{' '}
          <Link to="/groups" className="link">
            See group offers
          </Link>
        </Alert>
      )}
    </article>
  );
}

/** Upload: presign -> PUT straight to storage -> attach the object key to the request. */
function Attachments({
  request,
  onChange,
}: {
  request: LearningRequest;
  onChange: (r: LearningRequest) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const presign = await unwrap<Presign>(
        api.POST('/student/uploads/presign', {
          body: { contentType: file.type, sizeBytes: file.size },
        }),
      );
      const put = await fetch(presign.uploadUrl, {
        method: presign.method,
        headers: presign.headers,
        body: file,
      }).catch(() => null);
      if (!put?.ok)
        throw new ApiError(
          put?.status ?? 0,
          'UPLOAD_FAILED',
          'The file could not be uploaded. Try again.',
        );
      return unwrap<LearningRequest>(
        api.POST('/student/requests/{id}/attachments', {
          params: { path: { id: request.id } },
          body: { objectKey: presign.objectKey, fileName: file.name.slice(0, 200) },
        }),
      );
    },
    onSuccess: onChange,
  });
  const open = request.status === 'DRAFT' || request.status === 'OPEN';
  return (
    <section aria-labelledby="files">
      <SectionHeader id="files" title="Attachments" />
      {request.attachments.length > 0 ? (
        <ul className="mb-4 flex flex-col gap-2">
          {request.attachments.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="link text-sm">
                {a.fileName}
              </a>{' '}
              <span className="text-xs text-muted">{Math.ceil(a.sizeBytes / 1024)} KB</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted">
          Add a syllabus, a worksheet or a screenshot so tutors can quote accurately.
        </p>
      )}
      {open && (
        <>
          <input
            ref={input}
            type="file"
            accept={FILE_TYPES}
            className="sr-only"
            aria-label="Choose a file to attach"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > MAX_FILE_BYTES)
                return setLocalError('Files must be 10 MB or smaller.');
              setLocalError(null);
              upload.mutate(file);
            }}
          />
          <Button
            variant="secondary"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            Attach a file
          </Button>
          <p className="mt-2 text-xs text-muted">PDF, PNG or JPEG, up to 10 MB.</p>
        </>
      )}
      {(localError || upload.error) && (
        <div className="mt-3">
          <Alert tone="danger">{localError ?? describeAuthError(upload.error)}</Alert>
        </div>
      )}
    </section>
  );
}
