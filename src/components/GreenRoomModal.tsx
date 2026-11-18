import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  CameraOff,
  CheckCircle2,
  FlipHorizontal2,
  Gamepad2,
  ImagePlus,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { DEFAULT_VIDEO_FX } from '../constants/studioDefaults';
import { VideoFxSettings, WatchMode } from '../types/studio';
import { GatherLogo } from './GatherLogo';

interface GreenRoomModalProps {
  open: boolean;
  roomCode: string;
  initialName: string;
  initialAvatarUrl?: string;
  initialFx: VideoFxSettings;
  initialWatchMode?: WatchMode;
  isSignedIn?: boolean;
  onOpenAuth?: () => void;
  onCancel: () => void;
  onEnter: (payload: {
    name: string;
    avatarUrl?: string;
    micOn: boolean;
    camOn: boolean;
    stream: MediaStream | null;
    fx: VideoFxSettings;
    studioTitle?: string;
    watchMode: WatchMode;
    isHost: boolean;
  }) => void;
  isNewStudio: boolean;
}

const GoogleMark: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

const DEFAULT_TITLES: Record<WatchMode, string> = {
  standard: 'Gather Live Broadcast',
  shop: 'Studio Objects Live Drop',
  gamer: 'Ranked Squad Co-Stream',
};

export const GreenRoomModal: React.FC<GreenRoomModalProps> = ({
  open,
  roomCode,
  initialName,
  initialAvatarUrl,
  initialFx,
  initialWatchMode = 'standard',
  isSignedIn = false,
  onOpenAuth,
  onCancel,
  onEnter,
  isNewStudio,
}) => {
  const [name, setName] = useState(initialName || 'Maya Chen');
  const [studioTitle, setStudioTitle] = useState(DEFAULT_TITLES[initialWatchMode]);
  const [titleEdited, setTitleEdited] = useState(false);
  const [watchMode, setWatchMode] = useState<WatchMode>(initialWatchMode);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(initialAvatarUrl);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [fx, setFx] = useState<VideoFxSettings>(initialFx);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCam, setSelectedCam] = useState('');
  const [meterLevel, setMeterLevel] = useState(0);
  const [mediaUnavailable, setMediaUnavailable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (initialName) setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (initialAvatarUrl) setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  useEffect(() => {
    if (open) {
      setWatchMode(initialWatchMode);
      setTitleEdited(false);
      setStudioTitle(DEFAULT_TITLES[initialWatchMode]);
    }
  }, [open, initialWatchMode]);

  const closeModal = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeModal]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let rafId = 0;
    let analyserCtx: AudioContext | null = null;

    const initDevices = async () => {
      setMediaUnavailable(false);
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
          video: selectedCam
            ? { deviceId: { exact: selectedCam }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const list = await navigator.mediaDevices.enumerateDevices();
        if (active) setDevices(list);

        if (stream.getAudioTracks().length > 0) {
          analyserCtx = new AudioContext();
          const src = analyserCtx.createMediaStreamSource(stream);
          const analyser = analyserCtx.createAnalyser();
          analyser.fftSize = 128;
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!active) return;
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
              const v = Math.abs(data[i] - 128) / 128;
              if (v > peak) peak = v;
            }
            setMeterLevel(Math.min(100, Math.round(peak * 220)));
            rafId = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        if (active) setMediaUnavailable(true);
      }
    };

    void initDevices();

    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (analyserCtx) void analyserCtx.close();
    };
  }, [open, selectedMic, selectedCam, retryCount]);

  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = micOn;
    });
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = camOn;
    });
  }, [micOn, camOn]);

  if (!open) return null;

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'G';

  const bgMode = fx.bgMode || (fx.blurBg ? 'blur' : 'natural');
  const activeMeter = micOn ? meterLevel : 0;
  const activeSegments = Math.round((activeMeter / 100) * 12);
  const meterDb = activeMeter > 2 ? Math.round(-48 + (activeMeter / 100) * 48) : -60;
  const voiceRingScale = 1 + (activeMeter / 100) * 0.22;

  const audioInputs = devices.filter((d) => d.kind === 'audioinput');
  const videoInputs = devices.filter((d) => d.kind === 'videoinput');

  const handleSelectMode = (mode: WatchMode) => {
    setWatchMode(mode);
    if (!titleEdited) {
      setStudioTitle(DEFAULT_TITLES[mode]);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    onEnter({
      name: name.trim() || 'Host',
      avatarUrl,
      micOn,
      camOn,
      stream: streamRef.current,
      fx,
      studioTitle: isNewStudio ? studioTitle.trim() || DEFAULT_TITLES[watchMode] : undefined,
      watchMode,
      isHost: isNewStudio,
    });
  };

  const inputCls =
    'w-full h-9.5 px-3 rounded-[9px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-3 sm:p-5 overflow-y-auto gather-scroll animate-gather-backdrop"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="green-room-heading"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[940px] max-h-[92vh] overflow-y-auto gather-scroll rounded-[18px] gather-glass-elevated animate-gather-modal"
      >
        {/* Top Studio Lightbox Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5 border-b border-[var(--line)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-line)] grid place-items-center shrink-0">
              <GatherLogo size={16} />
            </span>
            <div className="min-w-0">
              <h2
                id="green-room-heading"
                className="font-display text-[15px] font-medium text-[var(--ink)] tracking-tight leading-tight"
              >
                Green Room Pre-Check
              </h2>
              <p className="text-[11px] text-[var(--ink-3)] font-mono-num mt-0.5 truncate">
                Room {roomCode} · {isNewStudio ? 'Host Broadcast Setup' : 'Guest Check-In'} · $0 Platform Fees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isSignedIn && onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="h-8 px-3 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[11.5px] font-medium text-[var(--ink)] inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <GoogleMark />
                <span className="hidden sm:inline">Sign in with Google</span>
                <span className="sm:hidden">Sign in</span>
              </button>
            )}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close green room"
              className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleJoin}
          className="grid grid-cols-1 lg:grid-cols-[57%_43%] min-w-0"
        >
          {/* Left 57%: Confidence Monitor & Color Console */}
          <div className="p-5 sm:p-6 space-y-4 min-w-0">
            <div className="relative aspect-video rounded-[14px] overflow-hidden bg-[#060a14] border border-white/12 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-150 ${
                  camOn && !mediaUnavailable ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  transform: fx.mirror ? 'scaleX(-1)' : 'none',
                  filter: `brightness(${fx.brightness}%) contrast(${fx.contrast}%) saturate(${fx.saturation}%)`,
                }}
              />

              {/* Studio Backdrop Vignette Preview */}
              {camOn && !mediaUnavailable && bgMode !== 'natural' && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      bgMode === 'dim'
                        ? 'radial-gradient(circle at 50% 45%, transparent 32%, rgba(6,10,22,0.74) 95%)'
                        : 'radial-gradient(circle at 50% 45%, transparent 40%, rgba(12,18,36,0.52) 95%)',
                  }}
                />
              )}

              {/* Subtle Optical Viewfinder Corner Brackets */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-3">
                <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/25 rounded-tl-[2px]" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-white/25 rounded-tr-[2px]" />
                <span className="absolute bottom-8 left-0 w-3 h-3 border-b border-l border-white/15 rounded-bl-[2px]" />
                <span className="absolute bottom-8 right-0 w-3 h-3 border-b border-r border-white/15 rounded-br-[2px]" />
              </div>

              {/* Top Unboxed Optical Status Bar */}
              <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between gap-2 text-[10px] font-mono-num tracking-[0.08em] uppercase pointer-events-none">
                <span className="inline-flex items-center gap-1.5 text-white/80">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      !mediaUnavailable && camOn
                        ? 'bg-emerald-400'
                        : micOn
                        ? 'bg-[#4f6ef7]'
                        : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    {camOn && !mediaUnavailable
                      ? 'Optical Feed · 720p60'
                      : 'Avatar Stage · Audio Ready'}
                  </span>
                </span>
                <span className="text-white/50">
                  {fx.mirror ? 'Mirrored' : 'Program Orientation'}
                </span>
              </div>

              {/* Avatar / Audio-Reactive Stage (when camera is off or unavailable) */}
              {(!camOn || mediaUnavailable) && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 p-4 text-center"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 44%, rgba(47,107,240,0.22), rgba(8,12,24,0.96) 72%)',
                  }}
                >
                  <div className="relative grid place-items-center">
                    {/* Audio-Reactive Pulse Halo behind Avatar */}
                    <span
                      aria-hidden="true"
                      className="absolute w-24 h-24 rounded-full border border-[#4f6ef7]/35 transition-transform duration-100"
                      style={{
                        transform: `scale(${voiceRingScale})`,
                        opacity: micOn ? 0.45 + (activeMeter / 100) * 0.55 : 0.2,
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute w-32 h-32 rounded-full border border-[#7c3aed]/20 transition-transform duration-150"
                      style={{
                        transform: `scale(${1 + (activeMeter / 100) * 0.3})`,
                        opacity: micOn ? 0.3 + (activeMeter / 100) * 0.45 : 0.12,
                      }}
                    />
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        referrerPolicy="no-referrer"
                        className="relative z-10 w-18 h-18 rounded-full object-cover border border-[#4f6ef7] shadow-xl"
                      />
                    ) : (
                      <div className="relative z-10 w-18 h-18 rounded-full gather-btn-primary font-display font-medium text-xl grid place-items-center shadow-xl">
                        {initials}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 max-w-[34ch]">
                    <div className="text-[12px] font-medium text-white/90">
                      {!camOn
                        ? 'Camera paused — broadcast uses your studio avatar'
                        : 'Camera & mic hardware not authorized yet'}
                    </div>
                    {mediaUnavailable && (
                      <button
                        type="button"
                        onClick={() => setRetryCount((c) => c + 1)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8ab4ff] hover:text-white transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry camera &amp; microphone check</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom Glass Hardware Dock */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMicOn((v) => !v)}
                    className={`h-8 px-3 rounded-[8px] text-[11.5px] font-semibold inline-flex items-center gap-1.5 backdrop-blur-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      micOn
                        ? 'bg-black/60 text-white border-white/15 hover:bg-black/80'
                        : 'gather-btn-live border-transparent'
                    }`}
                  >
                    {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    <span>{micOn ? 'Mic on' : 'Muted'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCamOn((v) => !v)}
                    className={`h-8 px-3 rounded-[8px] text-[11.5px] font-semibold inline-flex items-center gap-1.5 backdrop-blur-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      camOn
                        ? 'bg-black/60 text-white border-white/15 hover:bg-black/80'
                        : 'gather-btn-live border-transparent'
                    }`}
                  >
                    {camOn ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
                    <span>{camOn ? 'Cam on' : 'Cam off'}</span>
                  </button>
                </div>

                {/* Live 12-Bar LED Audio Input Meter */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] bg-black/65 backdrop-blur-xl border border-white/15">
                  <span className="text-[9.5px] font-mono-num tabular-nums text-white/60 w-9 text-right">
                    {micOn ? `${meterDb}dB` : 'MUTE'}
                  </span>
                  <div className="flex items-center gap-0.5" aria-label="Microphone input level">
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const lit = idx < activeSegments;
                      const segColor =
                        idx >= 10
                          ? 'bg-[var(--live)]'
                          : idx >= 7
                          ? 'bg-[var(--warn)]'
                          : 'bg-[var(--ok)]';
                      return (
                        <span
                          key={idx}
                          className={`w-1.5 h-2.5 rounded-[1px] transition-colors ${
                            lit ? segColor : 'bg-white/14'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Look & Color Grading Console */}
            <div className="rounded-[12px] bg-[var(--fill)] border border-[var(--line)] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4 text-[11.5px]">
                  {(
                    [
                      { id: 'natural', label: 'Natural' },
                      { id: 'blur', label: 'Soft Blur' },
                      { id: 'dim', label: 'Studio Dim' },
                    ] as const
                  ).map((mode) => {
                    const active = bgMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        aria-selected={active}
                        onClick={() =>
                          setFx((p) => ({
                            ...p,
                            bgMode: mode.id,
                            blurBg: mode.id === 'blur',
                          }))
                        }
                        className={`pb-1 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'border-[var(--accent)] text-[var(--ink)] font-medium'
                            : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2.5 text-[11px]">
                  <button
                    type="button"
                    aria-pressed={fx.mirror}
                    onClick={() => setFx((p) => ({ ...p, mirror: !p.mirror }))}
                    className={`h-7 px-2.5 rounded-[7px] border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      fx.mirror
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--ink)] font-medium'
                        : 'bg-transparent border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <FlipHorizontal2 className="w-3 h-3" />
                    <span>Mirror</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFx(DEFAULT_VIDEO_FX)}
                    className="h-7 px-2 rounded-[7px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs pt-1 border-t border-[var(--line)]">
                <label className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ink-3)]">Brightness</span>
                    <span className="font-mono-num tabular-nums text-[var(--ink-2)]">
                      {fx.brightness}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={140}
                    value={fx.brightness}
                    onChange={(e) => setFx((p) => ({ ...p, brightness: Number(e.target.value) }))}
                    className="gather-range w-full"
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ink-3)]">Contrast</span>
                    <span className="font-mono-num tabular-nums text-[var(--ink-2)]">
                      {fx.contrast}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={140}
                    value={fx.contrast}
                    onChange={(e) => setFx((p) => ({ ...p, contrast: Number(e.target.value) }))}
                    className="gather-range w-full"
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--ink-3)]">Color</span>
                    <span className="font-mono-num tabular-nums text-[var(--ink-2)]">
                      {fx.saturation}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={160}
                    value={fx.saturation}
                    onChange={(e) => setFx((p) => ({ ...p, saturation: Number(e.target.value) }))}
                    className="gather-range w-full"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right 43%: Format Architecture, Identity & Hardware Routing */}
          <div className="p-5 sm:p-6 flex flex-col justify-between gap-5 border-t lg:border-t-0 lg:border-l border-[var(--line)] min-w-0">
            <div className="space-y-4">
              {isNewStudio && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)] block">
                    Watch Page Format
                  </span>
                  <div
                    className="grid grid-cols-3 gap-2"
                    role="tablist"
                    aria-label="Watch Page Format"
                  >
                    {(
                      [
                        { id: 'standard', label: 'Broadcast', icon: Radio },
                        { id: 'shop', label: 'Live Shop', icon: ShoppingBag },
                        { id: 'gamer', label: 'Gaming', icon: Gamepad2 },
                      ] as Array<{
                        id: WatchMode;
                        label: string;
                        icon: React.ComponentType<{ className?: string }>;
                      }>
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const active = watchMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => handleSelectMode(opt.id)}
                          className={`p-2.5 rounded-[10px] border text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)] shadow-[0_0_0_1px_rgba(79,110,247,0.3)]'
                              : 'bg-[var(--fill)] border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--line-2)]'
                          }`}
                        >
                          <Icon
                            className={`w-3.5 h-3.5 mb-1.5 ${
                              active ? 'text-[var(--accent-text)]' : ''
                            }`}
                          />
                          <div className="text-[11.5px] font-semibold whitespace-nowrap">
                            {opt.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[var(--ink-3)] leading-relaxed">
                    {watchMode === 'standard'
                      ? 'Cinema Watch Page with live Q&A, audience polls, and 0%-fee direct Super Chats.'
                      : watchMode === 'shop'
                      ? 'Interactive product runway & 1-click Express Bag checkout right beside the video.'
                      : 'Squad queue, live map predictions, rig showcase & instant 30s replay clips.'}
                  </p>
                </div>
              )}

              {isNewStudio && (
                <label className="block space-y-1.5">
                  <span className="text-[11.5px] font-medium text-[var(--ink-2)]">Show title</span>
                  <input
                    type="text"
                    value={studioTitle}
                    onChange={(e) => {
                      setTitleEdited(true);
                      setStudioTitle(e.target.value);
                    }}
                    placeholder="My Live Broadcast"
                    className={inputCls}
                  />
                </label>
              )}

              {/* Display Name + Integrated Off-Cam Avatar Upload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="greenroom-display-name"
                    className="text-[11.5px] font-medium text-[var(--ink-2)]"
                  >
                    Your display name
                  </label>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-medium text-[var(--accent-text)] hover:underline inline-flex items-center gap-1 cursor-pointer">
                      <ImagePlus className="w-3 h-3" />
                      <span>{avatarUrl ? 'Replace avatar' : 'Upload avatar'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') setAvatarUrl(reader.result);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl(undefined)}
                        aria-label="Remove avatar photo"
                        className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="w-9.5 h-9.5 rounded-[9px] object-cover border border-[var(--accent)] shrink-0"
                    />
                  ) : (
                    <span className="w-9.5 h-9.5 rounded-[9px] bg-[var(--fill-hover)] border border-[var(--line-2)] text-[11px] font-display font-medium text-[var(--ink)] grid place-items-center shrink-0">
                      {initials}
                    </span>
                  )}
                  <input
                    id="greenroom-display-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Hardware Routing Matrix */}
              <div className="pt-2 border-t border-[var(--line)] space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                    Audio &amp; Video Routing
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono-num text-[10.5px] text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{mediaUnavailable ? 'Standby Mode' : 'Hardware Synced'}</span>
                  </span>
                </div>

                <label className="block space-y-1">
                  <span className="text-[11px] text-[var(--ink-3)]">Microphone</span>
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">System default microphone</option>
                    {audioInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Mic ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] text-[var(--ink-3)]">Camera</span>
                  <select
                    value={selectedCam}
                    onChange={(e) => setSelectedCam(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">System default camera</option>
                    {videoInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Enter / Launch Action */}
            <div className="space-y-2.5 pt-2">
              <button
                type="submit"
                className="group w-full h-11 rounded-[10px] gather-btn-primary text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span>{isNewStudio ? 'Launch Studio' : 'Enter Green Room'}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
              <p className="inline-flex w-full items-center justify-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--ink-3)] shrink-0" />
                <span>Locked rooms hold guests cleanly in the Waiting Lobby until admitted.</span>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
