import { ApiError } from '@tutora/api-client';
import { describeAuthError } from '@tutora/core';
import { Alert, Button, Modal, Textarea } from '@tutora/ui';
import { useState, type ReactNode } from 'react';

export const fieldErr = (err: unknown, key: string) =>
  err instanceof ApiError ? err.fieldErrors[key]?.[0] : undefined;

export const topError = (err: unknown) =>
  err && !(err instanceof ApiError && err.code === 'VALIDATION_FAILED')
    ? describeAuthError(err)
    : null;

/** Asks for a written reason (5-1000 characters, as the backend requires) before a decision. */
export function ReasonDialog({
  open,
  title,
  confirmLabel,
  danger = true,
  pending,
  error,
  onClose,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const short = reason.trim().length < 5;
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        setReason('');
        onClose();
      }}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!short) onConfirm(reason.trim());
        }}
      >
        {children}
        {topError(error) && <Alert tone="danger">{topError(error)}</Alert>}
        <Textarea
          label="Reason"
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
          hint="Shown to the person affected and kept in the audit log."
          error={fieldErr(error, 'reason')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={danger ? 'danger' : 'primary'}
            disabled={short}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
