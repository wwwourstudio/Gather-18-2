import React, { useState } from 'react';
import {
  Award,
  Check,
  FolderHeart,
  Gamepad2,
  Layers,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  ACCENT_SWATCHES,
  BACKDROP_PRESETS,
  DEFAULT_SPONSORS,
  STAGE_FONTS,
} from '../../constants/studioDefaults';
import {
  BackdropId,
  BrandBannerPreset,
  BrandKit,
  FrameStyle,
  GearSpec,
  NameTagStyle,
  OverlayGenMode,
  RoomState,
  SponsorBanner,
  StageFont,
  StageFontPreset,
  StageFrameStyle,
  WatchMode,
} from '../../types/studio';
import { sanitizeSvg, svgToCompactDataUrl } from '../../utils/aiGraphicRenderer';
import { CONSOLE_INPUT_CLS } from './consoleTypes';

interface LookTabProps {
  room: RoomState;
  onPatchRoom: (patch: Record<string, unknown>) => void;
  onSelectBrandFile: (kind: 'backdrop' | 'logo' | 'overlay', file: File) => void;
  brandKits?: BrandKit[];
  onApplyBrandKit?: (kit: BrandKit, options?: { openShop?: boolean }) => void;
  onSaveBrandKit?: (kit: BrandKit) => Promise<void> | void;
  onOpenAiStudio?: (tab?: 'pdf' | 'graphics' | 'kits' | 'audio' | 'bumper' | 'clips' | 'podcast') => void;
  onNotify?: (msg: string) => void;
}

const LOOK_VIBE_PRESETS: Array<{ label: string; mode: OverlayGenMode; prompt: string }> = [
  {
    label: 'Esports Tactical',
    mode: 'hud-frame',
    prompt: 'Sharp carbon tactical FPS HUD perimeter bezel with top kill-feed notch and glowing corner brackets',
  },
  {
    label: 'Neon Arcade',
    mode: 'webcam-frame',
    prompt: 'Cyber neon webcam bezel frame with angled holographic corner chamfer and dual glowing sidebars',
  },
  {
    label: 'Cozy Lo-Fi',
    mode: 'backdrop',
    prompt: 'Warm twilight studio loft gradient with subtle architectural light beams and acoustic panel grid',
  },
  {
    label: 'Executive',
    mode: 'logo',
    prompt: 'Minimalist geometric broadcast emblem monogram with clean circular ring and sharp negative space',
  },
];

function mapFontToPreset(font: StageFont): StageFontPreset {
  if (font === 'DM Serif Display') return 'Instrument Serif';
  if (font === 'Bebas Neue') return 'Oswald';
  if (font === 'JetBrains Mono' || font === 'Playfair Display' || font === 'Plus Jakarta Sans') {
    return font;
  }
  return 'Plus Jakarta Sans';
}

function mapFrameToPreset(frame: FrameStyle): StageFrameStyle {
  if (frame === 'none') return 'none';
  if (frame === 'border') return 'rounded';
  if (frame === 'corners') return 'floating';
  return 'cinema';
}

function mapBannerToPreset(style: RoomState['overlays']['banner']['style']): BrandBannerPreset {
  if (style === 'broadcast' || style === 'block') return 'breaking';
  if (style === 'minimal') return 'minimal';
  if (style === 'glass') return 'ticker';
  return 'classic';
}

export const LookTab: React.FC<LookTabProps> = ({
  room,
  onPatchRoom,
  onSelectBrandFile,
  brandKits = [],
  onApplyBrandKit,
  onSaveBrandKit,
  onOpenAiStudio,
  onNotify,
}) => {
  const [sponsorDraft, setSponsorDraft] = useState('');
  const [gearLabel, setGearLabel] = useState('');
  const [gearValue, setGearValue] = useState('');

  const [aiMode, setAiMode] = useState<OverlayGenMode>('hud-frame');
  const [aiPrompt, setAiPrompt] = useState(LOOK_VIBE_PRESETS[0].prompt);
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSvg, setAiSvg] = useState<string>('');
  const [aiTitle, setAiTitle] = useState<string>('');
  const [savingKit, setSavingKit] = useState(false);

  const sponsorsList = room.brand.sponsors || DEFAULT_SPONSORS;

  const handleGenerateOverlay = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/overlay-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: aiMode,
          prompt: aiPrompt.trim(),
          showTitle: room.title,
          primaryHex: room.brand.accent,
          secondaryHex: '#22d3ee',
          aspectRatio: room.scene.templateId.startsWith('v-') ? '9:16' : '16:9',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI design request failed.');
      const w = aiMode === 'logo' ? 512 : 1920;
      const h = aiMode === 'logo' ? 512 : 1080;
      setAiSvg(sanitizeSvg(String(data.svg || ''), w, h));
      setAiTitle(String(data.title || 'AI Stage Graphic'));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate AI overlay.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleRefineOverlay = async () => {
    if (!aiSvg || !aiRefinePrompt.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/overlay-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          svg: aiSvg,
          instruction: aiRefinePrompt.trim(),
          mode: aiMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refinement failed.');
      const w = aiMode === 'logo' ? 512 : 1920;
      const h = aiMode === 'logo' ? 512 : 1080;
      setAiSvg(sanitizeSvg(String(data.svg || ''), w, h));
      setAiRefinePrompt('');
      onNotify?.('Refined vector asset with Gemini.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to refine overlay.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleApplyGenerated = () => {
    if (!aiSvg) return;
    const dataUrl = svgToCompactDataUrl(aiSvg);
    if (aiMode === 'backdrop' || aiMode === 'thumbnail') {
      onPatchRoom({ brand: { ...room.brand, customBackdropUrl: dataUrl } });
      onNotify?.('Applied AI backdrop to stage.');
    } else if (aiMode === 'logo') {
      onPatchRoom({ brand: { ...room.brand, logoUrl: dataUrl } });
      onNotify?.('Applied AI corner logo to stage.');
    } else {
      onPatchRoom({
        ...(aiMode === 'hud-frame' ? { watchMode: 'gamer' } : {}),
        brand: { ...room.brand, customOverlayUrl: dataUrl },
      });
      onNotify?.(`Applied transparent ${aiMode === 'hud-frame' ? 'gaming HUD' : 'webcam'} frame.`);
    }
  };

  const handleSaveCurrentAsKit = async () => {
    if (!onSaveBrandKit) return;
    setSavingKit(true);
    try {
      const generatedDataUrl = aiSvg ? svgToCompactDataUrl(aiSvg) : '';
      const kit: BrandKit = {
        id: `kit-${Date.now().toString(36)}`,
        name: aiTitle || `${room.title.slice(0, 28)} Look`,
        niche: room.watchMode === 'gamer' ? 'gaming' : room.watchMode === 'shop' ? 'commerce' : 'creator',
        storeName: room.commerce.storeLabel || room.title || 'Gather Studio',
        storeTagline: room.overlays.banner.subtitle || 'Custom AI stage look',
        accentHex: room.brand.accent,
        secondaryHex: '#22d3ee',
        backdropPreset: room.brand.backdrop,
        stageFont: mapFontToPreset(room.brand.font),
        frameStyle: mapFrameToPreset(room.brand.frame),
        nameTagStyle: room.brand.nameTagStyle || 'glass',
        bannerStyle: mapBannerToPreset(room.overlays.banner.style),
        bannerTitle: room.overlays.banner.title || room.title,
        bannerSubtitle: room.overlays.banner.subtitle || '',
        logoUrl:
          aiMode === 'logo' && generatedDataUrl
            ? generatedDataUrl
            : room.brand.logoUrl || '',
        backdropUrl:
          (aiMode === 'backdrop' || aiMode === 'thumbnail') && generatedDataUrl
            ? generatedDataUrl
            : room.brand.customBackdropUrl || '',
        overlayUrl:
          (aiMode === 'hud-frame' || aiMode === 'webcam-frame') && generatedDataUrl
            ? generatedDataUrl
            : room.brand.customOverlayUrl || '',
        products: [],
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };
      await onSaveBrandKit(kit);
    } finally {
      setSavingKit(false);
    }
  };

  return (
    <div className="divide-y divide-[var(--line)] space-y-5">
      {/* Inline AI Gaming HUD & Stage Overlay Designer */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
            <h3 className="text-xs font-medium text-[var(--ink)] truncate">
              AI Gaming HUD &amp; Stage Designer
            </h3>
          </div>
          {onOpenAiStudio && (
            <button
              type="button"
              onClick={() => onOpenAiStudio('graphics')}
              className="text-[11px] font-medium text-[var(--accent-text)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full AI Studio →
            </button>
          )}
        </div>

        {/* Cross-Room Saved Brand Kits Quick Strip */}
        {brandKits.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] text-[var(--ink-3)]">
              <span className="inline-flex items-center gap-1">
                <FolderHeart className="w-3 h-3 text-[var(--cyan)]" />
                <span>Saved Brand Kits ({brandKits.length})</span>
              </span>
              {onOpenAiStudio && (
                <button
                  type="button"
                  onClick={() => onOpenAiStudio('kits')}
                  className="hover:text-[var(--ink)] cursor-pointer whitespace-nowrap"
                >
                  Manage
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto gather-scroll pb-0.5">
              {brandKits.slice(0, 8).map((kit) => (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => onApplyBrandKit?.(kit)}
                  className="h-7 px-2.5 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: kit.accentHex }}
                  />
                  <span className="max-w-[116px] truncate">{kit.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-[8px] bg-[var(--fill)] border border-[var(--line)]">
          {(
            [
              { id: 'hud-frame', label: 'HUD Frame' },
              { id: 'webcam-frame', label: 'Webcam' },
              { id: 'backdrop', label: 'Backdrop' },
              { id: 'logo', label: 'Logo' },
            ] as Array<{ id: OverlayGenMode; label: string }>
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setAiMode(m.id)}
              className={`h-6 rounded-[5px] text-[10.5px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                aiMode === m.id
                  ? 'gather-btn-primary text-white'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Vibe Preset Chips */}
        <div className="flex flex-wrap gap-1.5">
          {LOOK_VIBE_PRESETS.map((vibe) => (
            <button
              key={vibe.label}
              type="button"
              onClick={() => {
                setAiMode(vibe.mode);
                setAiPrompt(vibe.prompt);
              }}
              className="h-6 px-2 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[10.5px] text-[var(--ink-2)] hover:text-[var(--ink)] whitespace-nowrap cursor-pointer"
            >
              {vibe.label}
            </button>
          ))}
        </div>

        {/* Prompt + Generate */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe transparent HUD bezel or stage art..."
            className={`flex-1 min-w-0 ${CONSOLE_INPUT_CLS}`}
          />
          <button
            type="button"
            disabled={aiBusy || !aiPrompt.trim()}
            onClick={() => void handleGenerateOverlay()}
            className="h-8 px-3 rounded-[7px] gather-btn-primary text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            <span>{aiBusy ? 'Designing' : 'Generate'}</span>
          </button>
        </div>

        {aiError && (
          <div className="p-2.5 rounded-[8px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[11px] text-[var(--danger)]">
            {aiError}
          </div>
        )}

        {aiSvg && (
          <div className="p-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] space-y-2">
            <div
              className="rounded-[8px] border border-[var(--line)] overflow-hidden flex items-center justify-center p-2"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, rgba(148,163,184,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.08) 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
              }}
            >
              <img
                src={svgToCompactDataUrl(aiSvg)}
                alt={aiTitle || 'AI stage graphic preview'}
                className={aiMode === 'logo' ? 'h-24 w-24 object-contain' : 'w-full max-h-32 object-contain'}
              />
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={aiRefinePrompt}
                onChange={(e) => setAiRefinePrompt(e.target.value)}
                placeholder="Refine with Gemini (e.g. sharper corners)..."
                className={`flex-1 min-w-0 h-7 ${CONSOLE_INPUT_CLS}`}
              />
              <button
                type="button"
                disabled={aiBusy || !aiRefinePrompt.trim()}
                onClick={() => void handleRefineOverlay()}
                className="h-7 px-2.5 rounded-[6px] bg-[var(--surface-2)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
              >
                Refine
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              {onSaveBrandKit && (
                <button
                  type="button"
                  disabled={savingKit}
                  onClick={() => void handleSaveCurrentAsKit()}
                  className="h-7 px-2.5 rounded-[7px] bg-[var(--surface-2)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderHeart className="w-3 h-3" />
                  <span>{savingKit ? 'Saving…' : 'Save Kit'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleApplyGenerated}
                className="h-7 px-3 rounded-[7px] gather-btn-tip text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ml-auto"
              >
                <Check className="w-3 h-3" />
                <span>Apply to Stage</span>
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--ink)]">Stream Format &amp; Watch UI</h3>
          <span className="text-[10.5px] text-[var(--ink-3)]">Tailors Watch Page</span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-[8px] bg-[var(--fill)] border border-[var(--glass-border)]">
          {(
            [
              { id: 'standard', label: 'Broadcast' },
              { id: 'shop', label: 'Live Shop' },
              { id: 'gamer', label: 'Gaming' },
            ] as Array<{ id: WatchMode; label: string }>
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPatchRoom({ watchMode: m.id })}
              className={`h-7 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                room.watchMode === m.id
                  ? 'gather-btn-primary text-white'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {room.watchMode === 'gamer' && (
        <section className="pt-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
              <Gamepad2 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>Gaming Arena Match &amp; Loadout</span>
            </div>
            <span className="text-[10px] font-mono-num text-[var(--cyan)]">Live HUD</span>
          </div>
          <input
            type="text"
            value={room.gamer.gameTitle}
            onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, gameTitle: e.target.value } })}
            placeholder="Game title"
            className={`w-full ${CONSOLE_INPUT_CLS}`}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={room.gamer.modeOrRank}
              onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, modeOrRank: e.target.value } })}
              placeholder="Rank / Mode"
              className={CONSOLE_INPUT_CLS}
            />
            <input
              type="text"
              value={room.gamer.lobbyCode}
              onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, lobbyCode: e.target.value } })}
              placeholder="Lobby code"
              className={`${CONSOLE_INPUT_CLS} font-mono-num`}
            />
            <input
              type="text"
              value={room.gamer.seriesScore || ''}
              onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, seriesScore: e.target.value } })}
              placeholder="Series (e.g. BO3 · 1–0)"
              className={`${CONSOLE_INPUT_CLS} font-mono-num`}
            />
            <input
              type="text"
              value={room.gamer.currentMap || ''}
              onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, currentMap: e.target.value } })}
              placeholder="Map (e.g. Ascent)"
              className={CONSOLE_INPUT_CLS}
            />
          </div>

          <div className="p-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--glass-border)] space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <input
                  type="text"
                  value={room.gamer.teamAName ?? 'GATHER'}
                  onChange={(e) =>
                    onPatchRoom({ gamer: { ...room.gamer, teamAName: e.target.value } })
                  }
                  placeholder="Team A"
                  className={`w-full h-7 px-2 text-[11px] font-semibold ${CONSOLE_INPUT_CLS}`}
                />
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onPatchRoom({
                        gamer: {
                          ...room.gamer,
                          teamAScore: Math.max(0, (room.gamer.teamAScore ?? 11) - 1),
                        },
                      })
                    }
                    className="h-6 w-7 rounded bg-[var(--surface-2)] border border-[var(--glass-border)] text-xs font-bold text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono-num text-xs font-bold text-[var(--ink)]">
                    {room.gamer.teamAScore ?? 11}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onPatchRoom({
                        gamer: {
                          ...room.gamer,
                          teamAScore: (room.gamer.teamAScore ?? 11) + 1,
                        },
                      })
                    }
                    className="h-6 w-7 rounded gather-btn-primary text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <input
                  type="text"
                  value={room.gamer.teamBName ?? 'APEX'}
                  onChange={(e) =>
                    onPatchRoom({ gamer: { ...room.gamer, teamBName: e.target.value } })
                  }
                  placeholder="Team B"
                  className={`w-full h-7 px-2 text-[11px] font-semibold ${CONSOLE_INPUT_CLS}`}
                />
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onPatchRoom({
                        gamer: {
                          ...room.gamer,
                          teamBScore: Math.max(0, (room.gamer.teamBScore ?? 9) - 1),
                        },
                      })
                    }
                    className="h-6 w-7 rounded bg-[var(--surface-2)] border border-[var(--glass-border)] text-xs font-bold text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono-num text-xs font-bold text-[var(--ink)]">
                    {room.gamer.teamBScore ?? 9}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onPatchRoom({
                        gamer: {
                          ...room.gamer,
                          teamBScore: (room.gamer.teamBScore ?? 9) + 1,
                        },
                      })
                    }
                    className="h-6 w-7 rounded gather-btn-primary text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <input
              type="text"
              value={room.gamer.roundLabel ?? ''}
              onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, roundLabel: e.target.value } })}
              placeholder="Round / Phase (e.g. Round 21 · Buy Phase)"
              className={`w-full h-7 px-2 text-[11px] ${CONSOLE_INPUT_CLS}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={room.gamer.sensitivity ?? ''}
              onChange={(e) => onPatchRoom({ gamer: { ...room.gamer, sensitivity: e.target.value } })}
              placeholder="Sens (e.g. 0.35 / 280 eDPI)"
              className={`${CONSOLE_INPUT_CLS} font-mono-num`}
            />
            <input
              type="text"
              value={room.gamer.crosshairCode ?? ''}
              onChange={(e) =>
                onPatchRoom({ gamer: { ...room.gamer, crosshairCode: e.target.value } })
              }
              placeholder="Crosshair profile code"
              className={`${CONSOLE_INPUT_CLS} font-mono-num`}
            />
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={gearLabel}
              onChange={(e) => setGearLabel(e.target.value)}
              placeholder="Gear"
              className={`w-[24%] h-7 px-2 ${CONSOLE_INPUT_CLS}`}
            />
            <input
              type="text"
              value={gearValue}
              onChange={(e) => setGearValue(e.target.value)}
              placeholder="Model spec"
              className={`flex-1 h-7 px-2 ${CONSOLE_INPUT_CLS}`}
            />
            <button
              type="button"
              onClick={() => {
                if (!gearLabel.trim() || !gearValue.trim()) return;
                const spec: GearSpec = {
                  id: `gear-${Date.now()}`,
                  category: gearLabel.trim(),
                  label: gearLabel.trim(),
                  value: gearValue.trim(),
                };
                onPatchRoom({
                  gamer: { ...room.gamer, gearSpecs: [...room.gamer.gearSpecs, spec] },
                });
                setGearLabel('');
                setGearValue('');
              }}
              className="h-7 px-2.5 rounded-[6px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--ink)] cursor-pointer"
            >
              +
            </button>
          </div>
        </section>
      )}

      <section className="pt-4 space-y-2">
        <h3 className="text-xs font-semibold text-[var(--ink)]">Stage Accent Colour</h3>
        <div className="flex items-center gap-2">
          {ACCENT_SWATCHES.map((sw) => (
            <button
              key={sw.value}
              type="button"
              aria-label={sw.label}
              onClick={() => onPatchRoom({ brand: { ...room.brand, accent: sw.value } })}
              style={{ backgroundColor: sw.value }}
              className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                room.brand.accent === sw.value
                  ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--bg)] scale-110'
                  : ''
              }`}
            />
          ))}
          <input
            type="color"
            value={room.brand.accent}
            onChange={(e) => onPatchRoom({ brand: { ...room.brand, accent: e.target.value } })}
            aria-label="Custom accent colour"
            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
          />
        </div>
      </section>

      <section className="pt-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--ink)]">Backdrop &amp; PNG Overlay</h3>
          {(room.brand.customBackdropUrl || room.brand.customOverlayUrl) && (
            <button
              type="button"
              onClick={() =>
                onPatchRoom({
                  brand: {
                    ...room.brand,
                    customBackdropUrl: undefined,
                    customOverlayUrl: undefined,
                  },
                })
              }
              className="text-[11px] text-[var(--danger)] cursor-pointer"
            >
              Reset custom
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {(Object.keys(BACKDROP_PRESETS) as BackdropId[]).map((id) => {
            const p = BACKDROP_PRESETS[id];
            const active = room.brand.backdrop === id && !room.brand.customBackdropUrl;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  onPatchRoom({
                    brand: { ...room.brand, backdrop: id, customBackdropUrl: undefined },
                  })
                }
                style={{
                  background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})`,
                }}
                className={`h-10 rounded-[7px] border text-[10px] font-semibold flex items-end p-1.5 cursor-pointer ${
                  id === 'paper' ? 'text-slate-900' : 'text-white'
                } ${active ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-white/10'}`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <label className="h-8 px-2.5 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--ink-2)] inline-flex items-center justify-center gap-1.5 cursor-pointer hover:text-[var(--ink)] whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            <span>Custom Backdrop</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSelectBrandFile('backdrop', f);
              }}
            />
          </label>
          <label className="h-8 px-2.5 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)] text-[11px] font-medium text-[var(--accent-text)] inline-flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-110 whitespace-nowrap">
            <Layers className="w-3.5 h-3.5" />
            <span>{room.brand.customOverlayUrl ? 'Change PNG Frame' : '+ PNG Overlay'}</span>
            <input
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSelectBrandFile('overlay', f);
              }}
            />
          </label>
        </div>
      </section>

      <section className="pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-[var(--ink-3)] block">Stage Font</span>
            <select
              value={room.brand.font}
              onChange={(e) =>
                onPatchRoom({ brand: { ...room.brand, font: e.target.value as StageFont } })
              }
              className={`w-full ${CONSOLE_INPUT_CLS}`}
            >
              {STAGE_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] text-[var(--ink-3)] block">Stage Frame</span>
            <select
              value={room.brand.frame}
              onChange={(e) =>
                onPatchRoom({ brand: { ...room.brand, frame: e.target.value as FrameStyle } })
              }
              className={`w-full ${CONSOLE_INPUT_CLS}`}
            >
              <option value="none">None</option>
              <option value="border">Accent Border</option>
              <option value="corners">Viewfinder Corners</option>
              <option value="vignette">Studio Vignette</option>
            </select>
          </label>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] text-[var(--ink-3)]">Speaker Name Tag Style</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-[var(--ink-2)]">
              <input
                type="checkbox"
                checked={room.brand.showNames}
                onChange={(e) =>
                  onPatchRoom({ brand: { ...room.brand, showNames: e.target.checked } })
                }
                className="accent-[var(--accent)]"
              />
              <span>Show names</span>
            </label>
          </div>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-[7px] bg-[var(--fill)] border border-[var(--glass-border)]">
            {(['glass', 'solid', 'outline', 'minimal'] as NameTagStyle[]).map((ns) => (
              <button
                key={ns}
                type="button"
                onClick={() => onPatchRoom({ brand: { ...room.brand, nameTagStyle: ns } })}
                className={`h-6 rounded-[5px] text-[11px] font-semibold capitalize cursor-pointer ${
                  (room.brand.nameTagStyle || 'glass') === ns
                    ? 'gather-btn-primary text-white'
                    : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                }`}
              >
                {ns}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-[var(--ink-2)]">Corner Watermark Logo</span>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer">
              <span>{room.brand.logoUrl ? 'Change logo' : '+ Upload logo'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onSelectBrandFile('logo', f);
                }}
              />
            </label>
            {room.brand.logoUrl && (
              <button
                type="button"
                onClick={() => onPatchRoom({ brand: { ...room.brand, logoUrl: undefined } })}
                aria-label="Clear logo"
                className="text-[var(--danger)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="pt-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[var(--cyan)]" />
            <span>Sponsor Banner Rotator</span>
          </h3>
          <button
            type="button"
            onClick={() =>
              onPatchRoom({
                brand: {
                  ...room.brand,
                  sponsorsEnabled: !room.brand.sponsorsEnabled,
                  sponsors: sponsorsList,
                },
              })
            }
            className={`h-6 px-2.5 rounded-[6px] text-[11px] font-semibold cursor-pointer ${
              room.brand.sponsorsEnabled
                ? 'gather-btn-primary text-white'
                : 'bg-[var(--fill)] border border-[var(--glass-border)] text-[var(--ink-2)]'
            }`}
          >
            {room.brand.sponsorsEnabled ? 'Rotating On Stage' : 'Off'}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {[8, 15, 30].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => onPatchRoom({ brand: { ...room.brand, sponsorIntervalSec: sec } })}
              className={`h-6 px-2 rounded-[5px] text-[11px] font-mono-num cursor-pointer ${
                (room.brand.sponsorIntervalSec || 15) === sec
                  ? 'bg-[var(--accent-soft)] border border-[var(--accent-line)] text-[var(--accent-text)]'
                  : 'bg-[var(--fill)] text-[var(--ink-3)]'
              }`}
            >
              {sec}s
            </button>
          ))}
          <input
            type="text"
            value={sponsorDraft}
            onChange={(e) => setSponsorDraft(e.target.value)}
            placeholder="Add sponsor name..."
            className={`flex-1 h-7 ${CONSOLE_INPUT_CLS}`}
          />
          <button
            type="button"
            onClick={() => {
              if (!sponsorDraft.trim()) return;
              const next: SponsorBanner[] = [
                ...sponsorsList,
                { id: `sp-${Date.now()}`, label: sponsorDraft.trim() },
              ];
              onPatchRoom({
                brand: { ...room.brand, sponsors: next, sponsorsEnabled: true },
              });
              setSponsorDraft('');
            }}
            className="h-7 px-2.5 rounded-[6px] gather-btn-primary text-[11px] font-semibold cursor-pointer"
          >
            +
          </button>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {sponsorsList.map((sp) => (
            <div key={sp.id} className="py-1.5 flex items-center justify-between text-xs">
              <span className="text-[var(--ink-2)] truncate">{sp.label}</span>
              <button
                type="button"
                aria-label={`Remove ${sp.label}`}
                onClick={() =>
                  onPatchRoom({
                    brand: {
                      ...room.brand,
                      sponsors: sponsorsList.filter((item) => item.id !== sp.id),
                    },
                  })
                }
                className="text-[var(--ink-3)] hover:text-[var(--danger)] cursor-pointer p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
