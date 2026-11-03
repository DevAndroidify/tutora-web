import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Modal, Select, Textarea } from '@tutora/ui';
import { useState } from 'react';
import { describeAuthError } from './auth-ui';
import { REPORT_REASONS, type ReportEntityType, type ReportReason } from './types';

export interface ReportInput {
  subjectUserId: string;
  reason: ReportReason;
  entityType?: ReportEntityType;
  entityId?: string;
  details?: string;
}

/** "Report" link + dialog. Reports open a trust & safety case reviewed by staff. */
export function ReportButton({
  subjectUserId,
  subjectName,
  entityType,
  entityId,
  submit,
}: {
  subjectUserId: string;
  subjectName: string;
  entityType?: ReportEntityType;
  entityId?: string;
  submit: (input: ReportInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('MISLEADING_CLAIMS');
  const [details, setDetails] = useState('');
  const send = useMutation({
    mutationFn: () =>
      submit({ subjectUserId, reason, entityType, entityId, details: details.trim() || undefined }),
  });
  const close = () => {
    setOpen(false);
    send.reset();
    setDetails('');
  };
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Report
      </Button>
      <Modal open={open} title={`Report ${subjectName}`} onClose={close}>
        {send.isSuccess ? (
          <div className="flex flex-col gap-4">
            <Alert tone="success" title="Report received">
              Our trust &amp; safety team reviews every report. You won&apos;t be shown to{' '}
              {subjectName} as the reporter.
            </Alert>
            <Button onClick={close}>Done</Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate();
            }}
          >
            {send.isError && <Alert tone="danger">{describeAuthError(send.error)}</Alert>}
            <Select
              label="What happened?"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
            >
              {Object.entries(REPORT_REASONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Textarea
              label="Details (optional)"
              value={details}
              maxLength={2000}
              onChange={(e) => setDetails(e.target.value)}
              hint="Dates, what was said, anything that helps us check."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={send.isPending}>
                Send report
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
