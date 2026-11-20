import React, { useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Captions,
  Check,
  Clapperboard,
  Clock,
  Copy,
  Crosshair,
  Flame,
  Hand,
  Heart,
  Maximize2,
  Minimize2,
  Pin,
  Share2,
  ShoppingBag,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { DEFAULT_VIDEO_FX } from '../../constants/studioDefaults';
import {
  FlashSaleState,
  ProductItem,
  RoomState,
  WatchMode,
} from '../../types/studio';
import { StageCanvas } from '../StageCanvas';
import {
  formatClock,
  formatMoney,
  GamerSubTab,
  getWatchAvatar,
  RailTab,
} from './watchTypes';

interface WatchStageSectionProps {
  room: RoomState;
  isPreviewMode: boolean;
  localPreviewCanvas?: HTMLCanvasElement | null;
  broadcastStream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mirrorCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  elapsedSec: number;
  nowMs: number;
  stageSoundOn: boolean;
  onToggleStageSound: () => void;
  viewerCaptionsOn: boolean;
  onToggleViewerCaptions: () => void;
  theaterMode: boolean;
  onToggleTheaterMode: () => void;
  activePov: 'main' | 'host' | 'tac';
  onChangePov: (pov: 'main' | 'host' | 'tac') => void;
  pinnedProduct?: ProductItem;
  pinnedOverlayDismissed: boolean;
  onDismissPinnedOverlay: (dismissed: boolean) => void;
  activeFlashSale: FlashSaleState | null;
  onJumpToShopDrop: () => void;
  onAddToBag: (product: ProductItem, qty?: number, bundleLabel?: string, openDrawer?: boolean) => void;
  onSwitchWatchMode?: (mode: WatchMode) => void;
  isSubscribed: boolean;
  subscribing: boolean;
  onToggleSubscribe?: () => Promise<void>;
  onRaiseHand?: (topic: string) => void;
  onLowerHand?: () => void;
  myHandPosition: number;
  hasRaisedHand: boolean;
  onTriggerHype: () => void;
  hypeStreak: number;
  onQuickClipCapture: (title?: string) => void;
  clipSavedToast: boolean;
  arenaXp: number;
  wagerStake: number;
  onChangeWagerStake: (amt: number) => void;
  votedPollId: string | null;
  activePrediction: {
    pollId: string;
    optionId: string;
    optionLabel: string;
    stake: number;
    odds: number;
  } | null;
  onLockPrediction: (pollId: string, optionId: string, optionLabel: string, odds: number) => void;
  onOpenArenaTab: (rail: RailTab, subTab: GamerSubTab) => void;
}

export const WatchStageSection: React.FC<WatchStageSectionProps> = ({
  room,
  isPreviewMode,
  localPreviewCanvas,
  broadcastStream,
  videoRef,
  mirrorCanvasRef,
  elapsedSec,
  nowMs,
  stageSoundOn,
  onToggleStageSound,
  viewerCaptionsOn,
  onToggleViewerCaptions,
  theaterMode,
  onToggleTheaterMode,
  activePov,
  onChangePov,
  pinnedProduct,
  pinnedOverlayDismissed,
  onDismissPinnedOverlay,
  activeFlashSale,
  onJumpToShopDrop,
  onAddToBag,
  onSwitchWatchMode,
  isSubscribed,
  subscribing,
  onToggleSubscribe,
  onRaiseHand,
  onLowerHand,
  myHandPosition,
  hasRaisedHand,
  onTriggerHype,
  hypeStreak,
  onQuickClipCapture,
  clipSavedToast,
  arenaXp,
  wagerStake,
  onChangeWagerStake,
  votedPollId,
  activePrediction,
  onLockPrediction,
  onOpenArenaTab,
}) => {
  const stageFrameContainerRef = useRef<HTMLDivElement | null>(null);
  const [handPopoverOpen, setHandPopoverOpen] = useState(false);
  const [handTopic, setHandTopic] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedPartyInvite, setCopiedPartyInvite] = useState(false);
  const [copiedLobby, setCopiedLobby] = useState(false);
  const [copiedCrosshair, setCopiedCrosshair] = useState(false);

  const isShopMode = room.watchMode === 'shop';
  const isGamerMode = room.watchMode === 'gamer';
  const isStandardMode = room.watchMode === 'standard';
  const isVertical = room.aspectRatio === '9:16';

  const onStageSpeakers = room.participants.filter((p) => p.onStage);
  const hostSpeaker = onStageSpeakers.find((s) => s.role === 'host') || onStageSpeakers[0];
  const hostDisplayName = hostSpeaker?.name || 'Maya Chen';

  const activePoll = room.gamer.activePoll;
  const totalPollVotes = activePoll
    ? activePoll.options.reduce((sum, o) => sum + o.votes, 0)
    : 0;

  const liveCaptionLine =
    room.overlays.captionText ||
    `${onStageSpeakers[0]?.name || 'Host'}: Welcome to ${room.title} — drop your questions in Q&A.`;

  const liveSalePopup =
    room.commerce.latestSalePopup && nowMs - room.commerce.latestSalePopup.createdAt <= 7500
      ? room.commerce.latestSalePopup
      : null;

  const getProductSalePrice = (prod: ProductItem) => {
    if (activeFlashSale && activeFlashSale.productId === prod.id) {
      return Number((prod.price * (1 - activeFlashSale.discountPct / 100)).toFixed(2));
    }
    return prod.price;
  };

  const handleToggleFullscreen = () => {
    const el = stageFrameContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void el.requestFullscreen?.().catch(() => {});
    }
  };

  const handleCopyCrosshair = () => {
    const code = room.gamer.crosshairCode || '0;P;c;5;o;1;0l;4;0o;2;0a;1;0f;0;1b;0';
    void navigator.clipboard.writeText(code);
    setCopiedCrosshair(true);
    window.setTimeout(() => setCopiedCrosshair(false), 1800);
  };

  return (
    <section className="lg:min-h-0 min-w-0 w-full flex flex-col gap-2.5 overflow-visible lg:overflow-hidden">
      {/* Editorial Stream Header */}
      <header className="relative z-20 shrink-0 px-0.5 pt-0.5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.09em] uppercase text-[var(--ink-3)]">
            <span>
              {isShopMode
                ? room.commerce.storeLabel || 'Gather Sessions · Live Drop'
                : isGamerMode
                ? room.gamer.gameTitle
                : 'Gather Sessions · Live Broadcast'}
            </span>
            {isGamerMode && room.gamer.seriesScore && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-amber-600 dark:text-amber-300 font-mono-num">
                  {room.gamer.seriesScore}
                </span>
              </>
            )}
            {isGamerMode && room.gamer.modeOrRank && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-[var(--cyan)] normal-case tracking-normal font-medium">
                  {room.gamer.modeOrRank}
                </span>
              </>
            )}
            {isStandardMode && onStageSpeakers.length > 0 && (
              <>
                <span aria-hidden="true">/</span>
                <span className="normal-case tracking-normal font-medium text-[var(--ink-2)] truncate">
                  {onStageSpeakers.map((s) => s.name).join(', ')}
                </span>
              </>
            )}
          </div>

          <h1 className="font-display text-[22px] sm:text-[26px] font-normal tracking-[-0.025em] leading-tight text-[var(--ink)] text-balance truncate">
            {room.title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {isPreviewMode && onSwitchWatchMode && (
            <div className="gather-seg shrink-0" role="tablist" aria-label="Preview Stream Format">
              {(
                [
                  { id: 'standard', label: 'Broadcast' },
                  { id: 'shop', label: 'Shop' },
                  { id: 'gamer', label: 'Arena' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={room.watchMode === m.id}
                  onClick={() => onSwitchWatchMode(m.id)}
                  className={`gather-seg-btn ${room.watchMode === m.id ? 'active' : ''}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {isGamerMode && (
            <>
              {theaterMode && (
                <button
                  type="button"
                  onClick={onToggleTheaterMode}
                  className="h-8 px-3 rounded-[10px] gather-btn-primary text-[11.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Show Chat &amp; Arena</span>
                </button>
              )}
              {room.gamer.lobbyCode && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(room.gamer.lobbyCode);
                    setCopiedLobby(true);
                    window.setTimeout(() => setCopiedLobby(false), 1600);
                  }}
                  className="h-8 px-3 rounded-[10px] gather-liquid-pill text-[11.5px] font-mono-num font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedLobby ? (
                    <Check className="w-3.5 h-3.5 text-[var(--ok)]" strokeWidth={1.75} />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[var(--cyan)]" strokeWidth={1.65} />
                  )}
                  <span>{copiedLobby ? 'Lobby Copied' : room.gamer.lobbyCode}</span>
                </button>
              )}
            </>
          )}

          {isStandardMode && (
            <button
              type="button"
              onClick={onToggleViewerCaptions}
              className={`h-8 px-3 rounded-[10px] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                viewerCaptionsOn
                  ? 'bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--accent-text)]'
                  : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              <Captions className="w-3.5 h-3.5" strokeWidth={1.65} />
              <span>Captions</span>
            </button>
          )}

          {!isShopMode && onRaiseHand && (
            <div className="relative">
              {hasRaisedHand ? (
                <button
                  type="button"
                  onClick={() => onLowerHand?.()}
                  className="h-8 px-3 rounded-[10px] bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Hand className="w-3.5 h-3.5" strokeWidth={1.65} />
                  <span className="font-mono-num">#{myHandPosition} · Lower</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setHandPopoverOpen((v) => !v)}
                  className="h-8 px-3 rounded-[10px] gather-liquid-pill text-[12px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Hand className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" strokeWidth={1.65} />
                  <span>Call In</span>
                </button>
              )}

              {handPopoverOpen && !hasRaisedHand && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRaiseHand(
                      handTopic.trim() || 'Would love to join the live stage for a quick question!'
                    );
                    setHandTopic('');
                    setHandPopoverOpen(false);
                  }}
                  className="absolute right-0 top-10 z-40 w-[min(86vw,280px)] p-3.5 rounded-[16px] gather-glass-elevated space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[12px] font-semibold text-[var(--ink)]">
                    <span>Request Stage Call-In</span>
                    <button
                      type="button"
                      onClick={() => setHandPopoverOpen(false)}
                      className="text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.65} />
                    </button>
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={handTopic}
                    onChange={(e) => setHandTopic(e.target.value)}
                    placeholder="Topic or question for the host..."
                    className="w-full h-8 px-2.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--cyan)]"
                  />
                  <button
                    type="submit"
                    className="w-full h-8 rounded-[8px] gather-btn-primary text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Send Request
                  </button>
                </form>
              )}
            </div>
          )}

          {!isShopMode && onToggleSubscribe && (
            <button
              type="button"
              disabled={subscribing}
              onClick={() => void onToggleSubscribe()}
              className={`h-8 px-3 rounded-[10px] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                isSubscribed
                  ? 'bg-emerald-500/14 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                  : 'gather-liquid-pill text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              {isSubscribed ? (
                <BellRing className="w-3.5 h-3.5" strokeWidth={1.65} />
              ) : (
                <Bell className="w-3.5 h-3.5 text-[var(--cyan)]" strokeWidth={1.65} />
              )}
              <span>{subscribing ? 'Saving...' : isSubscribed ? 'Subscribed' : 'Notify'}</span>
            </button>
          )}

          {!isShopMode && (
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/?watch=${room.roomCode}`;
                void navigator.clipboard.writeText(url);
                setCopiedShare(true);
                window.setTimeout(() => setCopiedShare(false), 1800);
              }}
              aria-label="Copy Watch Link"
              className="h-8 px-3 rounded-[10px] gather-liquid-pill text-[12px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedShare ? (
                <Check className="w-3.5 h-3.5 text-[var(--ok)]" strokeWidth={1.75} />
              ) : (
                <Share2 className="w-3.5 h-3.5" strokeWidth={1.65} />
              )}
              <span>{copiedShare ? 'Copied' : 'Share'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Non-Overlapping Broadcast Viewport Frame (Docked HUD Header + Unobstructed 16:9 / 9:16 Stage + Docked Footer) */}
      <div
        ref={stageFrameContainerRef}
        className="flex-1 min-h-[260px] w-full flex flex-col overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--hud-bg)]"
      >
        {/* Docked Top Telemetry & Format HUD (Zero Overlap over Video) */}
        <div className="shrink-0 px-3 py-2 border-b border-[var(--hud-border)] flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[var(--hud-ink)]">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-[0.06em] uppercase ${
                room.isLive ? 'bg-[#e11d48] text-white' : 'bg-[#2563eb] text-white'
              }`}
            >
              {room.isLive ? 'LIVE' : 'PREVIEW'}
            </span>

            {isGamerMode ? (
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-[8px] bg-[var(--fill)] border border-[var(--line)] text-[11.5px]">
                <span className="font-medium tracking-wide text-[var(--cyan)]">
                  {room.gamer.teamAName || 'GATHER'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--fill-active)] font-mono-num font-medium leading-none">
                  {room.gamer.teamAScore ?? 11}
                </span>
                <span className="text-[var(--hud-ink-muted)] font-mono-num">–</span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--fill-active)] font-mono-num font-medium leading-none">
                  {room.gamer.teamBScore ?? 9}
                </span>
                <span className="font-medium tracking-wide text-rose-500 dark:text-rose-300">
                  {room.gamer.teamBName || 'APEX'}
                </span>
                <span className="hidden sm:inline text-[var(--hud-ink-muted)]">·</span>
                <span className="hidden sm:inline font-medium text-[var(--hud-ink-muted)]">
                  {room.gamer.currentMap || 'Ascent'}
                  {room.gamer.roundLabel ? ` · ${room.gamer.roundLabel}` : ''}
                </span>
              </div>
            ) : (
              <span className="text-[11.5px] font-medium text-[var(--hud-ink-muted)] truncate">
                {isShopMode ? 'Studio drop' : 'Behind the scenes'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onToggleStageSound}
              className={`h-7 px-3 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                stageSoundOn
                  ? 'gather-btn-primary text-white'
                  : 'gather-liquid-pill text-[var(--hud-ink)]'
              }`}
            >
              {stageSoundOn ? (
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{stageSoundOn ? 'Sound on' : 'Unmute mix'}</span>
            </button>

            {isShopMode && activeFlashSale ? (
              <button
                type="button"
                onClick={onJumpToShopDrop}
                className="h-7 px-3 rounded-[9px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] inline-flex items-center gap-2 text-[11px] font-mono-num font-semibold cursor-pointer whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-amber-600 dark:text-amber-400">
                  {activeFlashSale.discountPct}% OFF · {formatClock((activeFlashSale.endsAt - nowMs) / 1000)}
                </span>
              </button>
            ) : isGamerMode ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-[7px] bg-[var(--fill)] border border-[var(--line)] text-[10.5px] font-mono-num font-semibold text-[var(--ok)]">
                  18ms · {activePov === 'main' ? 'MAIN' : activePov === 'host' ? 'COMMS' : 'TAC'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCrosshair}
                  title="Copy Pro Crosshair Profile"
                  className="h-7 px-2.5 rounded-[8px] gather-liquid-pill text-[10.5px] font-mono-num font-semibold text-[var(--hud-ink)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  {copiedCrosshair ? (
                    <Check className="w-3 h-3 text-[var(--ok)]" />
                  ) : (
                    <Crosshair className="w-3 h-3 text-[var(--cyan)]" />
                  )}
                  <span>{copiedCrosshair ? 'Copied!' : '!crosshair'}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Unobstructed Cinema Media Frame */}
        <div className="gather-stage-wrap bg-[var(--stage-surface)] min-h-[200px]">
          {isPreviewMode && localPreviewCanvas ? (
            <div className={isVertical ? 'gather-stage-frame-vertical' : 'gather-stage-frame'}>
              <canvas ref={mirrorCanvasRef} className="w-full h-full block object-contain" />
            </div>
          ) : broadcastStream ? (
            <div className={isVertical ? 'gather-stage-frame-vertical' : 'gather-stage-frame'}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={!stageSoundOn}
                controls
                className="w-full h-full object-contain bg-[var(--stage-surface)]"
              />
            </div>
          ) : (
            <StageCanvas
              room={room}
              localClientId="watch-viewer"
              localStream={null}
              screenStream={null}
              remoteStreams={{}}
              activeMedia={null}
              videoFx={DEFAULT_VIDEO_FX}
              editMode={false}
              viewerMode
              onExitEditMode={() => {}}
              onUpdateCustomElements={() => {}}
              onDropMediaFile={() => {}}
              onMediaPageChange={() => {}}
              onStopMedia={() => {}}
              onCanvasReady={() => {}}
            />
          )}
        </div>

        {/* Docked Bottom Broadcast Control Bar (Zero Overlap over Video) */}
        <div className="shrink-0 px-3.5 py-2 border-t border-[var(--hud-border)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--hud-ink-muted)]">
          <div className="flex items-center gap-3 font-mono-num">
            <span className="font-semibold text-[var(--hud-ink)]">
              {room.isLive ? 'ON AIR' : 'PREVIEW'}
            </span>
            <span>{formatClock(elapsedSec)}</span>
            {liveSalePopup && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-emerald-500/12 border border-emerald-500/30 text-[var(--ok)] font-sans font-medium">
                Claimed #{liveSalePopup.orderNumber} · {liveSalePopup.buyerName} (${liveSalePopup.total.toFixed(2)})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono-num">
            {isShopMode && pinnedOverlayDismissed && pinnedProduct && (
              <button
                type="button"
                onClick={() => onDismissPinnedOverlay(false)}
                className="text-[11px] font-sans font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
              >
                Show pinned item
              </button>
            )}
            {isGamerMode && (
              <>
                <button
                  type="button"
                  onClick={() => onQuickClipCapture()}
                  className="h-6 px-2 rounded-[6px] gather-liquid-pill text-[10.5px] font-sans font-semibold text-[var(--hud-ink)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Clapperboard className="w-3 h-3 text-[var(--cyan)]" />
                  <span>{clipSavedToast ? 'Clipped!' : 'Clip 30s'}</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleTheaterMode}
                  className="hidden lg:inline-flex items-center gap-1 text-[10.5px] font-sans font-semibold text-[var(--hud-ink)] hover:text-[var(--accent-text)] cursor-pointer whitespace-nowrap"
                >
                  {theaterMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{theaterMode ? 'Show Rail' : 'Theater'}</span>
                </button>
              </>
            )}
            <span>{isGamerMode ? '1080p60' : '1080p'}</span>
            <button
              type="button"
              onClick={handleToggleFullscreen}
              aria-label="Toggle fullscreen"
              className="text-[var(--hud-ink)] hover:text-[var(--accent-text)] cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Non-Overlapping Docked Pinned Product Strip (Shop Mode) */}
      {isShopMode && pinnedProduct && !pinnedOverlayDismissed && (
        <div className="shrink-0 gather-card-obsidian rounded-[14px] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 animate-gather-msg">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src={pinnedProduct.imageUrl}
              alt={pinnedProduct.title}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-[9px] object-cover border border-[var(--line-2)] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wider uppercase text-[var(--ink-3)] whitespace-nowrap min-w-0">
                <Pin className="w-3 h-3 text-[var(--cyan)] shrink-0" />
                <span className="truncate">Pinned by {hostDisplayName}</span>
                <span className="text-amber-600 dark:text-amber-400 shrink-0">
                  · {pinnedProduct.stock} left
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[13.5px] font-semibold text-[var(--ink)] truncate min-w-0">
                  {pinnedProduct.title}
                </span>
                <span className="font-mono-num text-[14px] font-bold text-[var(--ink)] shrink-0">
                  {formatMoney(getProductSalePrice(pinnedProduct))}
                </span>
                {getProductSalePrice(pinnedProduct) < pinnedProduct.price && (
                  <span className="font-mono-num text-[11px] line-through text-[var(--ink-3)] shrink-0">
                    {formatMoney(pinnedProduct.price)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              disabled={pinnedProduct.stock <= 0}
              onClick={() => onAddToBag(pinnedProduct, 1, undefined, true)}
              className="flex-1 sm:flex-none justify-center h-9 sm:h-8 px-3.5 rounded-[9px] gather-btn-primary text-[12.5px] sm:text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Buy now · {formatMoney(getProductSalePrice(pinnedProduct))}</span>
            </button>
            <button
              type="button"
              onClick={() => onDismissPinnedOverlay(true)}
              aria-label="Hide pinned product bar"
              className="w-7 h-7 rounded-[7px] hover:bg-[var(--fill-hover)] text-[var(--ink-3)] hover:text-[var(--ink)] grid place-items-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Below-Stage Action Bars (Shop Mode) */}
      {isShopMode && (
        <div className="shrink-0 space-y-2">
          <div className="gather-card-obsidian rounded-[14px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                <span className="w-7 h-7 rounded-full bg-indigo-500 text-white text-[10px] font-bold grid place-items-center ring-2 ring-[var(--bg)]">
                  Y
                </span>
                <span className="w-7 h-7 rounded-full bg-violet-500 text-white text-[10px] font-bold grid place-items-center ring-2 ring-[var(--bg)]">
                  MC
                </span>
                <span className="w-7 h-7 rounded-full bg-sky-500 text-white text-[10px] font-bold grid place-items-center ring-2 ring-[var(--bg)]">
                  JB
                </span>
                <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-[10px] font-bold grid place-items-center ring-2 ring-[var(--bg)]">
                  N
                </span>
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-[12.5px] font-semibold text-[var(--ink)]">
                  Your shop party · {Math.max(4, onStageSpeakers.length + 2)}
                </div>
                <div className="text-[11px] text-[var(--ink-3)] truncate">
                  You, {hostDisplayName.split(' ')[0]}, Jon + Nina
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-[12px] font-medium text-[var(--ok)] whitespace-nowrap">
              <Check className="w-3.5 h-3.5" />
              <span>Synced to live</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/?watch=${room.roomCode}`;
                  void navigator.clipboard.writeText(url);
                  setCopiedShare(true);
                  window.setTimeout(() => setCopiedShare(false), 1800);
                }}
                className="h-8 px-3 rounded-[9px] gather-liquid-pill text-[12px] font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {copiedShare ? (
                  <Check className="w-3.5 h-3.5 text-[var(--ok)]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[var(--ink-2)]" />
                )}
                <span>{copiedShare ? 'Copied' : 'Copy link'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/?watch=${room.roomCode}`;
                  void navigator.clipboard.writeText(url);
                  setCopiedPartyInvite(true);
                  window.setTimeout(() => setCopiedPartyInvite(false), 2000);
                }}
                className="h-8 px-3.5 rounded-[9px] gather-btn-primary text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{copiedPartyInvite ? 'Invite copied' : 'Invite friends'}</span>
              </button>
            </div>
          </div>

          <div className="gather-card-obsidian rounded-[14px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {hostSpeaker?.avatarUrl ? (
                <img
                  src={hostSpeaker.avatarUrl}
                  alt={hostDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-[var(--line-2)] shrink-0"
                />
              ) : (
                <span className="w-9 h-9 rounded-full gather-btn-primary text-white text-xs font-bold grid place-items-center shrink-0">
                  {getWatchAvatar(hostDisplayName).initials}
                </span>
              )}
              <div className="min-w-0 leading-tight">
                <div className="text-[13px] font-semibold text-[var(--ink)] truncate">
                  {hostDisplayName}
                </div>
                <div className="text-[11px] text-[var(--ink-3)] truncate">
                  Live studio · {Math.max(1, room.viewerCount).toLocaleString()} watching
                </div>
              </div>
              <span className="hidden xl:inline-block pl-3 ml-1 border-l border-[var(--line)] text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[var(--ink-3)] whitespace-nowrap">
                Live with {hostDisplayName}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onToggleSubscribe && (
                <button
                  type="button"
                  disabled={subscribing}
                  onClick={() => void onToggleSubscribe()}
                  className={`h-8 px-4 rounded-[9px] text-[12px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    isSubscribed
                      ? 'bg-emerald-500/14 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                      : 'gather-btn-primary'
                  }`}
                >
                  {subscribing ? 'Saving...' : isSubscribed ? 'Following' : 'Follow'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/?watch=${room.roomCode}`;
                  void navigator.clipboard.writeText(url);
                  setCopiedShare(true);
                  window.setTimeout(() => setCopiedShare(false), 1800);
                }}
                className="h-8 px-3 rounded-[9px] gather-liquid-pill text-[12px] font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 text-[var(--ink-2)]" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={onTriggerHype}
                className="h-8 px-3 rounded-[9px] gather-liquid-pill text-[12px] font-mono-num font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Heart className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>{room.gamer.hypeCount}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Below-Stage Action Bars (Gamer Arena Mode) */}
      {isGamerMode && (
        <div className="shrink-0 space-y-2">
          <div className="gather-card-obsidian rounded-[14px] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {hostSpeaker?.avatarUrl ? (
                <img
                  src={hostSpeaker.avatarUrl}
                  alt={hostDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-[var(--line-2)] shrink-0"
                />
              ) : (
                <span className="w-8 h-8 rounded-full gather-btn-primary text-white text-xs font-bold grid place-items-center shrink-0">
                  {getWatchAvatar(hostDisplayName).initials}
                </span>
              )}
              <div className="min-w-0 leading-tight">
                <div className="text-[12.5px] font-semibold text-[var(--ink)] flex items-center gap-1.5 truncate">
                  <span>{hostDisplayName}</span>
                  <span className="text-[10.5px] font-mono-num text-[var(--ok)]">· 18ms</span>
                </div>
                <div className="text-[11px] text-[var(--ink-3)] truncate">
                  {room.gamer.teamAName || 'GATHER'} {room.gamer.teamAScore ?? 11} –{' '}
                  {room.gamer.teamBScore ?? 9} {room.gamer.teamBName || 'APEX'} ·{' '}
                  {room.gamer.sensitivity || '0.35 (280 eDPI)'}
                </div>
              </div>
            </div>

            <div className="hidden xl:flex items-center gap-1 p-0.5 rounded-[9px] bg-[var(--fill)] border border-[var(--line)]">
              {(
                [
                  { id: 'main', label: 'Main POV' },
                  { id: 'host', label: 'Squad Comms' },
                  { id: 'tac', label: 'Tac View' },
                ] as const
              ).map((pov) => (
                <button
                  key={pov.id}
                  type="button"
                  onClick={() => onChangePov(pov.id)}
                  className={`h-6 px-2.5 rounded-[7px] text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    activePov === pov.id
                      ? 'gather-btn-primary text-white'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                  }`}
                >
                  {pov.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={onTriggerHype}
                className="h-8 px-3 rounded-[9px] gather-liquid-pill text-[12px] font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap hover:border-amber-400/45 transition-colors"
              >
                <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>Hype</span>
                <span className="font-mono-num text-[var(--cyan)]">{room.gamer.hypeCount}</span>
                {hypeStreak > 1 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono-num text-[10px] font-bold">
                    ×{hypeStreak}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onQuickClipCapture()}
                className="h-8 px-3 rounded-[9px] gather-liquid-pill text-[12px] font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Clapperboard className="w-3.5 h-3.5 text-[var(--cyan)]" />
                <span>{clipSavedToast ? `Clipped @ ${formatClock(elapsedSec)}` : 'Clip 30s'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenArenaTab('companion', 'squad')}
                className="h-8 px-3 rounded-[9px] gather-liquid-pill text-[12px] font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Squad ({room.squadQueue.length})</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenArenaTab('companion', 'rig')}
                className="hidden sm:inline-flex h-8 px-2.5 rounded-[9px] gather-liquid-pill text-[11.5px] font-mono-num font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Crosshair className="w-3.5 h-3.5 text-[var(--cyan)]" />
                <span>!sens</span>
              </button>
            </div>
          </div>

          {activePoll && activePoll.options.length >= 2 && (
            <div className="gather-card-obsidian rounded-[14px] px-3.5 py-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <div className="flex items-center gap-2 min-w-0">
                  <Trophy className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" strokeWidth={1.75} />
                  <span className="font-semibold text-[var(--ink)] truncate">{activePoll.question}</span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/14 text-amber-700 dark:text-amber-300 font-mono-num text-[10.5px] font-bold whitespace-nowrap">
                    {arenaXp.toLocaleString()} XP
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="hidden sm:inline text-[11px] text-[var(--ink-3)]">Stake:</span>
                  {[50, 100, 250, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      disabled={votedPollId === activePoll.id || arenaXp < amt}
                      onClick={() => onChangeWagerStake(amt)}
                      className={`h-6 px-2 rounded-[6px] text-[10.5px] font-mono-num font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default ${
                        wagerStake === amt
                          ? 'gather-btn-primary text-white'
                          : 'bg-[var(--fill)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-[var(--line)]'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                  <span className="font-mono-num text-[11px] text-[var(--ink-3)] pl-1">
                    {totalPollVotes} picks
                  </span>
                </div>
              </div>

              {(() => {
                const leftOpt = activePoll.options[0];
                const rightOpt = activePoll.options[1];
                const leftPct =
                  totalPollVotes > 0 ? Math.round((leftOpt.votes / totalPollVotes) * 100) : 50;
                const rightPct = 100 - leftPct;
                const leftOdds = Number((100 / Math.max(15, leftPct)).toFixed(2));
                const rightOdds = Number((100 / Math.max(15, rightPct)).toFixed(2));
                const hasVoted = votedPollId === activePoll.id;

                return (
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full bg-[var(--fill-active)] overflow-hidden flex">
                      <div
                        style={{ width: `${leftPct}%` }}
                        className="h-full bg-gradient-to-r from-[#3b82f6] to-[#7dd3fc] transition-all duration-500 ease-out"
                      />
                      <div
                        style={{ width: `${rightPct}%` }}
                        className="h-full bg-gradient-to-r from-[#818cf8] to-[#f43f5e] transition-all duration-500 ease-out"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { opt: leftOpt, pct: leftPct, odds: leftOdds, tone: 'text-[var(--cyan)]' },
                        {
                          opt: rightOpt,
                          pct: rightPct,
                          odds: rightOdds,
                          tone: 'text-rose-600 dark:text-rose-300',
                        },
                      ].map(({ opt, pct, odds, tone }) => {
                        const isMyPick =
                          activePrediction?.pollId === activePoll.id &&
                          activePrediction?.optionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={!activePoll.isOpen || hasVoted}
                            onClick={() => onLockPrediction(activePoll.id, opt.id, opt.label, odds)}
                            className={`h-8 px-3 rounded-[9px] flex items-center justify-between gap-2 text-[11.5px] cursor-pointer disabled:cursor-default transition-all ${
                              isMyPick
                                ? 'bg-[var(--accent-soft)] border border-[var(--accent-line)]'
                                : 'gather-liquid-pill'
                            }`}
                          >
                            <span className="truncate font-semibold text-[var(--ink)]">
                              {isMyPick ? `Picked · ${opt.label}` : opt.label}
                            </span>
                            <span className="flex items-center gap-2 font-mono-num shrink-0">
                              <span className="text-[10.5px] text-[var(--ink-3)]">{odds}×</span>
                              <span className={`font-bold ${tone}`}>{pct}%</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {activePrediction?.pollId === activePoll.id && (
                      <div className="flex items-center justify-between text-[11px] font-mono-num text-[var(--ok)] pt-0.5">
                        <span>
                          Locked {activePrediction.stake} XP on {activePrediction.optionLabel}
                        </span>
                        <span>
                          Potential win: +{Math.round(activePrediction.stake * activePrediction.odds)} XP
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Below-Stage Captions Strip (Standard Broadcast Mode) */}
      {isStandardMode && viewerCaptionsOn && (
        <div className="shrink-0 gather-card-obsidian rounded-[12px] px-4 py-2 flex items-center gap-2.5 text-[12px] text-[var(--ink)]">
          <Captions className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" strokeWidth={1.65} />
          <p className="truncate leading-snug text-[var(--ink-2)]">{liveCaptionLine}</p>
        </div>
      )}
    </section>
  );
};
