import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRealtimeEvent, useRealtimeStatus, useToast } from '@tutora/core';

/** Keeps admin queues fresh from realtime events and surfaces urgent ones as toasts. */
export function AdminLive() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const status = useRealtimeStatus();
  useRealtimeEvent<{ caseId?: string; id?: string }>('moderation.case_updated', (e) => {
    void qc.invalidateQueries({ queryKey: ['admin', 'cases'] });
    const id = e.caseId ?? e.id;
    if (id) void qc.invalidateQueries({ queryKey: ['admin', 'case', id] });
  });
  useRealtimeEvent<{ sessionId?: string }>('dispute.opened', () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'disputes'] });
    toast({ title: 'New dispute', body: 'A learner disputed a session. The payment stays held.' });
  });
  useRealtimeEvent<{ reason?: string }>('payments.alert', (e) => {
    toast({
      title: 'Payments alert',
      body: e.reason ? e.reason.replace(/_/g, ' ').toLowerCase() : undefined,
      action: { label: 'Open desk', onClick: () => void navigate({ to: '/' }) },
    });
  });
  return (
    <span
      className="hidden items-center gap-1.5 text-xs font-extrabold text-muted sm:inline-flex"
      title={
        status === 'live' ? 'Receiving live updates' : 'Live updates paused; pages refresh on open'
      }
    >
      <span
        className={`size-2 rounded-full ${status === 'live' ? 'bg-success' : 'bg-muted'}`}
        aria-hidden
      />
      {status === 'live' ? 'Live' : 'Offline'}
    </span>
  );
}
