/**
 * Live session room on LiveKit. Imported lazily (`@tutora/core/live`) so the WebRTC
 * client only downloads when someone actually joins.
 */
import { Alert, Button, cn, Tag } from '@tutora/ui';
import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
} from 'livekit-client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { SessionApi } from './sessions';
import type { JoinToken, LiveMode } from './types';

const MODES: Array<{ value: LiveMode; label: string; hint: string }> = [
  { value: 'FULL_VIDEO', label: 'Video', hint: 'Camera and screen' },
  { value: 'AUDIO_ONLY', label: 'Audio only', hint: 'Saves data on weak connections' },
  { value: 'WHITEBOARD_ONLY', label: 'Whiteboard', hint: 'Audio + shared drawing' },
];

const downlinkKbps = () => {
  const c = (navigator as Navigator & { connection?: { downlink?: number } }).connection;
  return c?.downlink ? Math.round(c.downlink * 1000) : undefined;
};

function Tile({
  participant,
  label,
  version,
  mirrored,
}: {
  participant: Participant;
  label: string;
  version: number;
  mirrored?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const cam = participant.getTrackPublication(Track.Source.Camera);
  const screen = participant.getTrackPublication(Track.Source.ScreenShare);
  const mic = participant.getTrackPublication(Track.Source.Microphone);
  const shown = screen?.track ?? cam?.track;
  const camOn = !!shown && !(screen?.track ? screen.isMuted : cam?.isMuted);
  useEffect(() => {
    const el = video.current;
    if (!shown || !el) return;
    shown.attach(el);
    return () => void shown.detach(el);
  }, [shown, version]);
  useEffect(() => {
    const el = audio.current;
    if (participant.isLocal || !mic?.track || !el) return;
    mic.track.attach(el);
    return () => void mic.track?.detach(el);
  }, [mic?.track, participant.isLocal, version]);
  return (
    <figure
      className={cn(
        'relative aspect-video overflow-hidden bg-night',
        participant.isSpeaking && 'outline outline-4 outline-brand',
      )}
    >
      <video
        ref={video}
        autoPlay
        playsInline
        muted={participant.isLocal}
        className={cn('size-full object-cover', !camOn && 'hidden', mirrored && 'scale-x-[-1]')}
      />
      {!camOn && (
        <div className="flex size-full items-center justify-center">
          <span className="font-display text-6xl font-black text-white/30">
            {label.slice(0, 1)}
          </span>
        </div>
      )}
      {!participant.isLocal && <audio ref={audio} autoPlay />}
      <figcaption className="absolute bottom-0 left-0 flex items-center gap-2 bg-black/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white">
        {label}
        {mic?.isMuted && <span aria-label="muted">· muted</span>}
      </figcaption>
    </figure>
  );
}

/** Simple shared-screen whiteboard: draw, clear, and save PNG snapshots to the session. */
function Whiteboard({ onSave }: { onSave: (blob: Blob, isFinal: boolean) => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState('#111111');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1280, 720);
  }, []);
  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * 1280,
      ((e.clientY - r.top) / r.height) * 720,
    ] as const;
  };
  const save = async (isFinal: boolean) => {
    const el = canvas.current;
    if (!el) return;
    setSaving(true);
    const blob = await new Promise<Blob | null>((res) => el.toBlob(res, 'image/png'));
    try {
      if (blob) await onSave(blob, isFinal);
      setSaved(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvas}
        width={1280}
        height={720}
        aria-label="Whiteboard"
        className="aspect-video w-full touch-none border-2 border-text bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext('2d')!;
          const [x, y] = point(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const [x, y] = point(e);
          ctx.strokeStyle = color;
          ctx.lineWidth = color === '#ffffff' ? 28 : 4;
          ctx.lineCap = 'round';
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => (drawing.current = false)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {['#111111', '#c8102e', '#1f6fde', '#1d7a46', '#ffffff'].map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c === '#ffffff' ? 'Eraser' : `Pen ${c}`}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className={cn('size-8 border-2', color === c ? 'border-brand' : 'border-border')}
            style={{ background: c }}
          />
        ))}
        <Button
          variant="ghost"
          onClick={() => {
            const ctx = canvas.current?.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, 1280, 720);
            }
          }}
        >
          Clear
        </Button>
        <Button variant="secondary" loading={saving} onClick={() => void save(false)}>
          Save snapshot
        </Button>
        {saved && <span className="text-xs text-muted">Saved {saved}</span>}
      </div>
    </div>
  );
}

export interface LiveRoomProps {
  sessionId: string;
  token: JoinToken;
  api: SessionApi;
  /** Labels for tiles, by LiveKit identity ("tutor:<id>" / "student:<id>"). */
  nameFor: (identity: string) => string;
  onLeave: () => void;
}

export default function LiveRoom({ sessionId, token, api, nameFor, onLeave }: LiveRoomProps) {
  // One Room per connection attempt. Reusing a single Room across effect runs (React StrictMode
  // runs effects twice in development) lets the first run's disconnect tear down the second.
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  });
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<'connecting' | 'connected' | 'reconnecting' | 'failed'>(
    'connecting',
  );
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LiveMode>('FULL_VIDEO');
  const modeRef = useRef<LiveMode>('FULL_VIDEO');
  const [notice, setNotice] = useState<string | null>(null);
  const [mic, setMic] = useState(true);
  const boardUsed = useRef(false);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const saveSnapshot = useCallback(
    async (blob: Blob, isFinal: boolean) => {
      boardUsed.current = true;
      const p = await api.presignSnapshot(sessionId, {
        contentType: 'image/png',
        sizeBytes: blob.size,
      });
      const put = await fetch(p.uploadUrl, { method: p.method, headers: p.headers, body: blob });
      if (!put.ok) throw new Error('Snapshot upload failed');
      await api.saveSnapshot(sessionId, { objectKey: p.objectKey, isFinal });
    },
    [api, sessionId],
  );

  const applyMode = useCallback(
    async (next: LiveMode, reason: 'manual' | 'auto') => {
      const room = roomRef.current;
      if (!room) return;
      modeRef.current = next;
      setMode(next);
      const video = next === 'FULL_VIDEO';
      await room.localParticipant.setCameraEnabled(video).catch(() => undefined);
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) {
          if (pub.kind === Track.Kind.Video) pub.setSubscribed(video);
        }
      }
      bump();
      void api
        .modeEvent(sessionId, { mode: next, downlinkKbps: downlinkKbps(), reason })
        .catch(() => undefined);
    },
    [api, bump, sessionId],
  );

  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    let cancelled = false;
    // Render this attempt's room (deferred: the effect only wires up the external object).
    queueMicrotask(() => {
      if (!cancelled) setRoom(room);
    });
    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ActiveSpeakersChanged,
    ] as const;
    events.forEach((e) => room.on(e, bump));
    room.on(RoomEvent.Reconnecting, () => setState('reconnecting'));
    room.on(RoomEvent.Reconnected, () => setState('connected'));
    // Only a disconnect of the live attempt counts (not one we started in cleanup).
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) onLeaveRef.current();
    });
    room.on(RoomEvent.ConnectionQualityChanged, (q: ConnectionQuality, p: Participant) => {
      if (p.isLocal && q === ConnectionQuality.Poor && modeRef.current === 'FULL_VIDEO') {
        setNotice('Your connection is weak, so we switched to audio only. Switch back any time.');
        void applyMode('AUDIO_ONLY', 'auto');
      }
    });
    (async () => {
      try {
        await room.connect(token.url, token.token);
        if (cancelled) return;
        await room.localParticipant
          .setMicrophoneEnabled(true)
          .catch(() => setError('Microphone blocked. Allow it in your browser to speak.'));
        const slow = (downlinkKbps() ?? 10_000) < 400;
        if (slow) {
          setNotice('Slow connection detected: starting in audio only.');
          await applyMode('AUDIO_ONLY', 'auto');
        } else {
          await room.localParticipant
            .setCameraEnabled(true)
            .catch(() => setError('Camera blocked. You can continue with audio.'));
        }
        setState('connected');
        bump();
      } catch (e) {
        if (!cancelled) {
          setState('failed');
          setError(e instanceof Error ? e.message : 'Could not connect to the live room.');
        }
      }
    })();
    return () => {
      cancelled = true;
      room.removeAllListeners();
      void room.disconnect();
      if (roomRef.current === room) roomRef.current = null;
    };
    // Connect once per token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.token, token.url]);

  const leave = async () => {
    if (boardUsed.current) {
      // Keep the last board state as the final snapshot for the replay.
      const canvas = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Whiteboard"]');
      const blob =
        canvas && (await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png')));
      if (blob) await saveSnapshot(blob, true).catch(() => undefined);
    }
    const r = roomRef.current;
    r?.removeAllListeners();
    await r?.disconnect();
    onLeave();
  };

  if (!room) {
    return (
      <section aria-label="Live session" className="bg-night p-6 text-white">
        <Tag tone="warning">connecting</Tag>
      </section>
    );
  }

  const everyone: Participant[] = [
    room.localParticipant,
    ...(room.remoteParticipants.values() as Iterable<RemoteParticipant>),
  ];

  return (
    <section
      aria-label="Live session"
      className="flex flex-col gap-4 bg-night p-4 text-white md:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Tag tone={state === 'connected' ? 'danger' : 'warning'}>
          {state === 'connected' ? '● Live' : state}
        </Tag>
        <span className="text-xs uppercase tracking-[0.14em] text-white/60">
          {everyone.length} in the room
        </span>
        <div role="group" aria-label="Bandwidth mode" className="ml-auto flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              title={m.hint}
              aria-pressed={mode === m.value}
              onClick={() => void applyMode(m.value, 'manual')}
              className={cn(
                'px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]',
                mode === m.value
                  ? 'bg-brand text-black'
                  : 'border border-white/30 text-white/80 hover:border-white',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {notice && <p className="border-l-4 border-brand pl-3 text-sm text-white/80">{notice}</p>}
      {error && <Alert tone="warning">{error}</Alert>}
      {mode === 'WHITEBOARD_ONLY' ? (
        <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
          <div className="text-text">
            <Whiteboard onSave={saveSnapshot} />
          </div>
          <div className="flex flex-col gap-3">
            {everyone.map((p) => (
              <Tile
                key={p.identity}
                participant={p}
                version={version}
                label={p.isLocal ? 'You' : nameFor(p.identity)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className={cn('grid gap-3', everyone.length > 1 && 'md:grid-cols-2')}>
          {everyone.map((p) => (
            <Tile
              key={p.identity}
              participant={p}
              version={version}
              mirrored={p.isLocal}
              label={p.isLocal ? 'You' : nameFor(p.identity)}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2 border-t border-white/10 pt-4">
        <Button
          variant="secondary"
          className="border-white text-white hover:bg-white hover:text-black"
          onClick={async () => {
            await room.localParticipant.setMicrophoneEnabled(!mic);
            setMic(!mic);
            bump();
          }}
        >
          {mic ? 'Mute' : 'Unmute'}
        </Button>
        <Button variant="danger" onClick={() => void leave()}>
          Leave
        </Button>
      </div>
    </section>
  );
}
