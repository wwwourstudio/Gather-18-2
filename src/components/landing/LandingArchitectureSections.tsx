import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Calendar } from 'lucide-react';
import { WatchMode } from '../../types/studio';

interface LandingArchitectureSectionsProps {
  previewMode: WatchMode;
  onSelectPreviewMode: (mode: WatchMode) => void;
  onOpenWatchDemo: (mode: WatchMode) => void;
  onCreateStudio: (mode?: WatchMode) => void;
  onOpenSchedule: () => void;
  isSignedIn?: boolean;
  userName?: string | null;
  onOpenAuth?: () => void;
}

const LiveAnalyserShowcaseCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const syncSize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(240, Math.round(rect.width * dpr));
      canvas.height = Math.max(96, Math.round(rect.height * dpr));
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(host);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const samples = 72;
    const chA = new Array<number>(samples).fill(0.28);
    const chB = new Array<number>(samples).fill(0.18);
    let phase = 0;
    let rafId = 0;

    for (let i = 0; i < samples; i++) {
      chA[i] = 0.25 + 0.38 * Math.abs(Math.sin(i * 0.21)) + 0.14 * Math.sin(i * 0.49);
      chB[i] = 0.18 + 0.28 * Math.abs(Math.cos(i * 0.17));
    }

    const drawFrame = (advance: boolean) => {
      if (advance) {
        phase += 0.12;
        const nextA = Math.min(
          0.94,
          0.26 + 0.42 * Math.abs(Math.sin(phase * 1.15)) + 0.18 * Math.abs(Math.sin(phase * 2.7))
        );
        const nextB = Math.min(
          0.82,
          0.18 + 0.34 * Math.abs(Math.cos(phase * 0.85)) + 0.12 * Math.sin(phase * 1.9)
        );
        chA.push(nextA);
        if (chA.length > samples) chA.shift();
        chB.push(nextB);
        if (chB.length > samples) chB.shift();
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const w = canvas.width;
        const h = canvas.height;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const styles = getComputedStyle(document.documentElement);
        const colOk = styles.getPropertyValue('--ok').trim() || '#10b981';
        const colAccent = styles.getPropertyValue('--accent').trim() || '#3b82f6';
        const colWarn = styles.getPropertyValue('--warn').trim() || '#f59e0b';
        const colLine = styles.getPropertyValue('--line').trim() || 'rgba(148,163,184,0.2)';

        ctx.clearRect(0, 0, w, h);
        const slotW = w / samples;
        const barW = Math.max(1.5 * dpr, slotW * 0.62);

        ctx.strokeStyle = colLine;
        ctx.lineWidth = Math.max(1, dpr * 0.75);
        for (const yRatio of [0.25, 0.55, 0.85]) {
          const y = Math.round(h * yRatio);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        for (let i = 0; i < samples; i++) {
          const v = chA[i];
          const barH = Math.max(3 * dpr, v * (h - 14 * dpr));
          const x = i * slotW + (slotW - barW) * 0.5;
          const y = h - 6 * dpr - barH;
          ctx.fillStyle = v > 0.76 ? colWarn : colOk;
          ctx.globalAlpha = 0.28 + (i / samples) * 0.65;
          ctx.fillRect(x, y, barW, barH);
        }

        ctx.globalAlpha = 0.92;
        ctx.strokeStyle = colAccent;
        ctx.lineWidth = Math.max(1.5 * dpr, 1.5);
        ctx.beginPath();
        for (let i = 0; i < samples; i++) {
          const x = (i + 0.5) * slotW;
          const y = h - 6 * dpr - chB[i] * (h - 14 * dpr);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(() => drawFrame(true));
      }
    };

    drawFrame(false);
    if (!reducedMotion) {
      rafId = requestAnimationFrame(() => drawFrame(true));
    }

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="w-full h-24 rounded-[10px] border border-[var(--line)] bg-[var(--fill)] overflow-hidden"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export const LandingArchitectureSections: React.FC<LandingArchitectureSectionsProps> = ({
  previewMode,
  onSelectPreviewMode,
  onOpenWatchDemo,
  onCreateStudio,
  onOpenSchedule,
  isSignedIn,
  userName,
  onOpenAuth,
}) => {
  const [smartExample, setSmartExample] = useState<'media' | 'reorder'>('media');
  const [directorMode, setDirectorMode] = useState<'copilot' | 'balanced' | 'fast'>('balanced');

  return (
    <div className="w-[92%] max-w-[1400px] mx-auto space-y-20 sm:space-y-28 pt-12 pb-10">
      {/* 01. Asymmetric Broadcast Engine Bento */}
      <section id="landing-capabilities" className="space-y-8 scroll-mt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div className="space-y-2 max-w-[60ch]">
            <div className="text-[12px] font-medium text-[var(--ink-3)]">
              01 · Studio architecture
            </div>
            <h2 className="font-display text-[clamp(1.75rem,3vw,2.75rem)] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--ink)] text-balance">
              Television control room, engineered in browser memory.
            </h2>
          </div>
          <p className="text-[14px] text-[var(--ink-2)] max-w-[42ch] leading-relaxed">
            Every frame, stem, and scene transition executes locally at 60 frames per second with
            zero native plugins.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Cell 01: OffscreenCanvas + Smart Transition */}
          <div className="lg:col-span-7 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[12px] font-mono-num text-[var(--accent-text)]">
                  01 · OffscreenCanvas 60fps &amp; Smart Transitions
                </span>
                <div className="flex items-center gap-1 p-1 rounded-[8px] bg-[var(--fill)] border border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => setSmartExample('media')}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      smartExample === 'media'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Heavy Media Swap
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmartExample('reorder')}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      smartExample === 'reorder'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Participant Re-order
                  </button>
                </div>
              </div>

              <h3 className="font-display text-xl sm:text-2xl font-medium text-[var(--ink)] tracking-[-0.02em]">
                {smartExample === 'media'
                  ? 'Dissolve 340ms for screen shares & full-bleed decks.'
                  : 'Slide 260ms or instant Cut when speakers shift seats.'}
              </h3>

              <p className="text-[14px] text-[var(--ink-2)] leading-relaxed max-w-[54ch]">
                A dedicated Web Worker compositor composites 1080p60 video frames off the main
                thread while Smart Transition picks the cleanest optical cut or crossfade based on
                media complexity.
              </p>
            </div>

            <div className="relative h-48 sm:h-56 rounded-[12px] overflow-hidden border border-[var(--line)] bg-[#0b1224]">
              <img
                src="/src/assets/images/hero_studio_backdrop_1794839256456.jpg"
                alt="Gather hardware broadcast studio backdrop"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute inset-x-4 bottom-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-white">
                <span className="font-semibold">
                  {smartExample === 'media'
                    ? 'Screen Share / Keynote -> Optical Dissolve'
                    : 'Split Duo / Quad Grid -> Spatial Slide'}
                </span>
                <span className="font-mono-num text-white/80">
                  {smartExample === 'media' ? '340ms ease-out' : '260ms spatial'}
                </span>
              </div>
            </div>
          </div>

          {/* Cell 02: OPFS Crash-Proof Recording */}
          <div className="lg:col-span-5 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="text-[12px] font-mono-num text-[var(--ink-3)]">
                02 · Local OPFS ISO Capture
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-medium text-[var(--ink)] tracking-[-0.02em]">
                Crash-proof chunked WebM &amp; 48 kHz WAV stems.
              </h3>
              <p className="text-[14px] text-[var(--ink-2)] leading-relaxed">
                Program streams flush directly into Origin Private File System chunks every second
                alongside uncompressed 16-bit PCM WAV audio stems — recoverable even if your browser
                closes mid-show.
              </p>
            </div>

            <div className="divide-y divide-[var(--line)] border-t border-[var(--line)] pt-2 text-[13px]">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-[var(--ink-2)]">Master Audio Stem</span>
                <span className="font-mono-num font-semibold text-[var(--ink)]">48 kHz · 16-bit WAV</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-[var(--ink-2)]">Program Video Capture</span>
                <span className="font-mono-num font-semibold text-[var(--ink)]">1080p60 · Chunked OPFS</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-[var(--ink-2)]">Session Recovery</span>
                <span className="font-mono-num font-semibold text-[var(--ok)]">Automatic re-assembly</span>
              </div>
            </div>
          </div>

          {/* Cell 03: Live Audio History AnalyserNode */}
          <div
            id="landing-audio"
            className="lg:col-span-5 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 flex flex-col justify-between gap-6 scroll-mt-6"
          >
            <div className="space-y-3">
              <div className="text-[12px] font-mono-num text-[var(--ink-3)]">
                03 · Web Audio AnalyserNode Bus
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-medium text-[var(--ink)] tracking-[-0.02em]">
                60fps audio peak history on every channel strip.
              </h3>
              <p className="text-[14px] text-[var(--ink-2)] leading-relaxed">
                Spot mic clipping, stinger headroom, and RMS voice balance at a glance with
                per-channel high-pass clarity EQ and compression.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11.5px] font-mono-num text-[var(--ink-3)]">
                <span>Host Mic + Master Bus</span>
                <span>-12 dB nominal · 0 dB clip</span>
              </div>
              <LiveAnalyserShowcaseCanvas />
            </div>
          </div>

          {/* Cell 04: Autonomous Cue AI Auto-Director */}
          <div className="lg:col-span-7 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[12px] font-mono-num text-[var(--cyan)]">
                  04 · Cue AI Auto-Director
                </span>
                <div className="flex items-center gap-1 p-1 rounded-[8px] bg-[var(--fill)] border border-[var(--line)]">
                  {(['copilot', 'balanced', 'fast'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDirectorMode(m)}
                      className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                        directorMode === m
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <h3 className="font-display text-xl sm:text-2xl font-medium text-[var(--ink)] tracking-[-0.02em]">
                Autonomous scene cues driven by chat momentum &amp; speech.
              </h3>
              <p className="text-[14px] text-[var(--ink-2)] leading-relaxed max-w-[54ch]">
                Run solo without a producer. Cue AI listens for product mentions, chat spikes, and
                topic shifts to pin items, update lower-thirds, and bookmark replay clips.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[var(--line)] pt-4 text-[12.5px]">
              <div>
                <div className="font-semibold text-[var(--ink)]">Cadence</div>
                <div className="font-mono-num text-[var(--ink-2)] mt-0.5">
                  {directorMode === 'copilot'
                    ? 'Manual approval'
                    : directorMode === 'balanced'
                    ? '12s editorial gate'
                    : '6s fast-cut arena'}
                </div>
              </div>
              <div>
                <div className="font-semibold text-[var(--ink)]">Live Tools</div>
                <div className="text-[var(--ink-2)] mt-0.5">
                  Scene · Banner · Pin · Poll
                </div>
              </div>
              <div>
                <div className="font-semibold text-[var(--ink)]">Post-Show</div>
                <div className="text-[var(--ink-2)] mt-0.5">
                  Chapters &amp; Magic Clips
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 02. Three Native Watch Formats */}
      <section id="landing-formats" className="space-y-8 scroll-mt-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div className="space-y-2 max-w-[58ch]">
            <div className="text-[12px] font-medium text-[var(--ink-3)]">
              02 · Built-in Watch destinations
            </div>
            <h2 className="font-display text-[clamp(1.75rem,3vw,2.75rem)] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--ink)] text-balance">
              One studio, three interactive audience rooms.
            </h2>
          </div>
          <p className="text-[14px] text-[var(--ink-2)] max-w-[40ch] leading-relaxed">
            Switch watch experiences live without changing URLs or splitting your audience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(
            [
              {
                num: '01',
                mode: 'standard' as WatchMode,
                title: 'Broadcast & Podcasts',
                desc: 'Up to 6 guests on stage, eye-line teleprompter, Q&A call-ins, and syndicated podcast RSS + WAV export.',
                meta: 'Multi-guest · Teleprompter · RSS',
                image: '/src/assets/images/product_broadcast_mic_1794839257210.jpg',
                alt: 'Broadcast microphone studio setup',
                cta: 'Preview Broadcast',
              },
              {
                num: '02',
                mode: 'shop' as WatchMode,
                title: 'Live Shop Drops',
                desc: 'Sync Shopify or Etsy catalogs in one click. Pin flash timers, bundle discounts, and an Express Bag side-by-side.',
                meta: 'Shopify · Etsy · 1-Click Bag',
                image: '/src/assets/images/product_ceramic_mug_1794839256911.jpg',
                alt: 'Ceramic pour-over mug product showcase',
                cta: 'Preview Live Shop',
              },
              {
                num: '03',
                mode: 'gamer' as WatchMode,
                title: 'Gaming Arena',
                desc: 'Live viewer map polls, squad queue match lobbies, gear spec cards, and instant 30-second clutch replay clips.',
                meta: 'Squad Queue · Polls · 30s Clips',
                image: '/src/assets/images/product_gaming_keyboard_1794839258672.jpg',
                alt: 'Custom mechanical gaming keyboard showcase',
                cta: 'Preview Gaming Arena',
              },
            ] as const
          ).map((card) => {
            const active = previewMode === card.mode;
            return (
              <div
                key={card.mode}
                className={`rounded-[16px] border overflow-hidden flex flex-col justify-between transition-colors ${
                  active
                    ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-[var(--surface)]'
                }`}
              >
                <div className="relative aspect-[4/3] bg-[#0b1224] overflow-hidden">
                  <img
                    src={card.image}
                    alt={card.alt}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute left-4 bottom-3 text-xs font-mono-num text-white/85">
                    {card.num} · {card.meta}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between gap-5">
                  <div className="space-y-2">
                    <h3 className="font-display text-lg font-medium text-[var(--ink)]">
                      {card.title}
                    </h3>
                    <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed">{card.desc}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => onSelectPreviewMode(card.mode)}
                      className="text-[12.5px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
                    >
                      Load in Hero
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenWatchDemo(card.mode)}
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--accent-text)] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
                    >
                      <span>{card.cta}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 03. Direct Creator Payouts & Conversion */}
      <section
        id="landing-payouts"
        className="rounded-[20px] border border-[var(--line-2)] bg-[var(--surface)] p-8 sm:p-12 scroll-mt-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[58%_42%] gap-8 items-center">
          <div className="space-y-4">
            <div className="text-[12px] font-mono-num text-[var(--ok)]">
              03 · Direct Creator Economics
            </div>
            <h2 className="font-display text-[clamp(1.85rem,3.2vw,2.9rem)] font-medium leading-[1.06] tracking-[-0.03em] text-[var(--ink)] text-balance">
              Keep 100% of every tip, bundle, and ticket.
            </h2>
            <p className="text-[15px] text-[var(--ink-2)] leading-relaxed max-w-[52ch]">
              Connect PayPal, Venmo, Cash App, or Stripe payment links directly to your live chat
              and Watch stage. Viewers support or check out inline without leaving the broadcast.
            </p>
          </div>

          <div className="flex flex-col sm:items-end justify-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onCreateStudio(previewMode)}
                className="h-12 px-6 rounded-[12px] gather-btn-primary text-[14.5px] font-semibold inline-flex items-center gap-2.5 whitespace-nowrap cursor-pointer"
              >
                <span>Create a studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenSchedule}
                className="h-12 px-5 rounded-[12px] border border-[var(--line-2)] hover:bg-[var(--fill-hover)] text-[14px] font-medium text-[var(--ink)] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Calendar className="w-4 h-4 text-[var(--cyan)]" />
                <span>Schedule show</span>
              </button>
            </div>
            <div className="text-[12px] text-[var(--ink-3)] font-mono-num">
              0% platform fee · Browser-native · Ready in seconds
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Editorial Footer */}
      <footer className="pt-4 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-4 text-[12px] text-[var(--ink-3)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-display font-medium text-[var(--ink)]">gather.</span>
          <span aria-hidden="true">·</span>
          <span>100% Free Studio</span>
          <span aria-hidden="true">·</span>
          <span>Direct Creator Payouts</span>
          {onOpenAuth && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="text-[var(--ink-2)] hover:text-[var(--ink)] hover:underline underline-offset-4 cursor-pointer"
              >
                {isSignedIn && userName
                  ? `Signed in as ${userName.split(' ')[0]}`
                  : 'Creator Sign in'}
              </button>
            </>
          )}
        </div>
        <div className="font-semibold text-[var(--ink-2)]">Made in Texas · ourstudio</div>
      </footer>
    </div>
  );
};
