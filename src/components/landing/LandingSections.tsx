import React from 'react';
import {
  ArrowRight,
  AudioLines,
  CalendarClock,
  Clapperboard,
  Gamepad2,
  Link2,
  MonitorUp,
  Play,
  Radio,
  ShoppingBag,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import { WatchMode } from '../../types/studio';
import { GatherLogo } from '../GatherLogo';

interface LandingSectionsProps {
  onCreateStudio: (mode?: WatchMode) => void;
  onOpenWatchDemo: (mode: WatchMode) => void;
  onOpenSchedule: () => void;
}

const FEATURES: Array<{ icon: React.ElementType; title: string; body: string }> = [
  {
    icon: Users,
    title: 'Up to six on stage',
    body: 'Invite guests with a link. Everyone gets a mic, camera and lighting check in the green room before they join.',
  },
  {
    icon: Clapperboard,
    title: 'Scenes that cut cleanly',
    body: 'Solo, split, spotlight and grid layouts with smart, dissolve or beat-synced transitions between them.',
  },
  {
    icon: AudioLines,
    title: 'A real audio mixer',
    body: 'Per-guest faders, voice ducking under music, and a deck of stingers you can fire on cue.',
  },
  {
    icon: MonitorUp,
    title: 'Present anything',
    body: 'Share a screen or window, page through a PDF deck, or roll a video — right inside the scene.',
  },
  {
    icon: Wand2,
    title: 'An AI producer',
    body: 'Gemini suggests the next scene, drafts lower thirds, and writes show notes when you wrap.',
  },
  {
    icon: Radio,
    title: 'Record, clip, publish',
    body: 'Record locally while you stream, save 30-second replay clips, and publish episodes to a podcast feed.',
  },
];

const FORMATS: Array<{
  id: WatchMode;
  icon: React.ElementType;
  name: string;
  tagline: string;
  points: string[];
  tone: string;
}> = [
  {
    id: 'standard',
    icon: Radio,
    name: 'Broadcast',
    tagline: 'Talk shows, panels, podcasts and AMAs.',
    points: ['Live Q&A with upvotes', 'Viewer call-ins', 'Captions and direct tips'],
    tone: 'from-[#2563eb]/25 to-[#1d4ed8]/5',
  },
  {
    id: 'shop',
    icon: ShoppingBag,
    name: 'Live Shop',
    tagline: 'Product drops your audience can buy mid-show.',
    points: ['Pin products on stage', 'Flash sales with timers', 'Shopify catalog import'],
    tone: 'from-[#10b981]/22 to-[#059669]/5',
  },
  {
    id: 'gamer',
    icon: Gamepad2,
    name: 'Gaming Arena',
    tagline: 'Co-streams with a crowd that plays along.',
    points: ['Match predictions', 'Hype trains and clips', 'Squad queue sign-ups'],
    tone: 'from-[#8b5cf6]/25 to-[#7c3aed]/5',
  },
];

const STEPS: Array<{ icon: React.ElementType; title: string; body: string }> = [
  {
    icon: Sparkles,
    title: 'Create a studio',
    body: 'Pick a format, name your show, and check your camera and mic. No download, no account needed to try it.',
  },
  {
    icon: Link2,
    title: 'Bring your guests',
    body: 'Share the invite link or room code. Lock the room and admit people from the waiting lobby when you are ready.',
  },
  {
    icon: Play,
    title: 'Go live',
    body: 'Hit Go Live and share your watch page. Viewers chat, ask questions, shop or play along — no app required.',
  },
];

const sectionHeading = 'font-display text-[clamp(1.7rem,3vw,2.6rem)] font-normal leading-[1.08] tracking-[-0.03em] text-[var(--ink)] text-balance';
const eyebrow = 'text-[11.5px] font-medium tracking-[0.14em] uppercase text-[var(--accent-text)]';

export const LandingSections: React.FC<LandingSectionsProps> = ({
  onCreateStudio,
  onOpenWatchDemo,
  onOpenSchedule,
}) => {
  const year = new Date().getFullYear();

  return (
    <div className="w-[90%] max-w-[1360px] mx-auto">
      {/* Features */}
      <section id="features" className="scroll-mt-6 py-16 sm:py-24 border-t border-[var(--line)]">
        <div className="max-w-[640px] space-y-3">
          <p className={eyebrow}>Features</p>
          <h2 className={sectionHeading}>Everything a live show needs, in one browser tab.</h2>
          <p className="text-[15px] leading-[1.65] text-[var(--ink-2)] max-w-[52ch]">
            Gather replaces the stack of capture software, plugins and dashboards with a single studio
            you and your guests open from a link.
          </p>
        </div>

        <div className="mt-10 grid gap-px rounded-[16px] overflow-hidden border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="bg-[var(--bg)] p-6 sm:p-7 space-y-3">
              <span className="w-9 h-9 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-line)] grid place-items-center">
                <Icon className="w-[18px] h-[18px] text-[var(--accent-text)]" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h3 className="font-display text-[17px] font-medium text-[var(--ink)] tracking-[-0.01em]">{title}</h3>
              <p className="text-[14px] leading-[1.6] text-[var(--ink-2)]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Formats */}
      <section id="formats" className="scroll-mt-6 py-16 sm:py-24 border-t border-[var(--line)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[620px] space-y-3">
            <p className={eyebrow}>Formats</p>
            <h2 className={sectionHeading}>One studio, three kinds of show.</h2>
            <p className="text-[15px] leading-[1.65] text-[var(--ink-2)] max-w-[52ch]">
              Each format comes with its own watch page, built for what your audience does while they watch.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {FORMATS.map(({ id, icon: Icon, name, tagline, points, tone }) => (
            <article
              key={id}
              className="relative flex flex-col rounded-[16px] border border-[var(--line-2)] bg-[var(--fill)] overflow-hidden"
            >
              <div className={`absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${tone} pointer-events-none`} aria-hidden="true" />
              <div className="relative p-6 sm:p-7 flex flex-col gap-5 flex-1">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-[10px] bg-[var(--bg)]/60 border border-[var(--line-2)] grid place-items-center">
                    <Icon className="w-5 h-5 text-[var(--ink)]" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-[21px] font-medium text-[var(--ink)] tracking-[-0.02em]">{name}</h3>
                </div>
                <p className="text-[14.5px] leading-[1.55] text-[var(--ink-2)]">{tagline}</p>
                <ul className="space-y-2 text-[13.5px] text-[var(--ink-2)]">
                  {points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-[var(--accent)] shrink-0" aria-hidden="true" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onCreateStudio(id)}
                    className="h-10 px-4 rounded-[9px] gather-btn-primary text-[13px] font-medium inline-flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                  >
                    Start a {name.toLowerCase()}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenWatchDemo(id)}
                    className="h-10 px-3.5 rounded-[9px] border border-[var(--line-2)] hover:bg-[var(--fill-hover)] text-[13px] font-medium text-[var(--ink)] inline-flex items-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    Watch demo
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-6 py-16 sm:py-24 border-t border-[var(--line)]">
        <div className="max-w-[620px] space-y-3">
          <p className={eyebrow}>How it works</p>
          <h2 className={sectionHeading}>Live in three steps.</h2>
        </div>

        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map(({ icon: Icon, title, body }, idx) => (
            <li key={title} className="relative space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono-num text-[12px] text-[var(--ink-3)]">0{idx + 1}</span>
                <span className="h-px flex-1 bg-[var(--line-2)]" aria-hidden="true" />
                <Icon className="w-4 h-4 text-[var(--accent-text)]" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="font-display text-[19px] font-medium text-[var(--ink)] tracking-[-0.015em]">{title}</h3>
              <p className="text-[14px] leading-[1.6] text-[var(--ink-2)] max-w-[40ch]">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA */}
      <section className="py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-[20px] border border-[var(--accent-line)] bg-[var(--accent-soft)] px-6 py-12 sm:px-12 sm:py-16 text-center">
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-full bg-[var(--accent)]/25 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative space-y-5 max-w-[560px] mx-auto">
            <h2 className={sectionHeading}>Your first show is one click away.</h2>
            <p className="text-[15px] leading-[1.6] text-[var(--ink-2)]">
              Free to start. Open a studio now, or schedule it and we will put a countdown on your watch page.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onCreateStudio('standard')}
                className="group h-12 px-6 rounded-[10px] gather-btn-primary text-[14.5px] font-medium inline-flex items-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              >
                Create a studio
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onOpenSchedule}
                className="h-12 px-5 rounded-[10px] border border-[var(--line-2)] bg-[var(--bg)]/40 hover:bg-[var(--fill-hover)] text-[14px] font-medium text-[var(--ink)] inline-flex items-center gap-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <CalendarClock className="w-4 h-4" aria-hidden="true" />
                Schedule a show
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 border-t border-[var(--line)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[13px] text-[var(--ink-3)]">
        <div className="flex items-center gap-2.5">
          <GatherLogo size={18} />
          <span className="font-display text-[17px] font-medium text-[var(--ink)] tracking-[-0.03em]">
            gather<span className="text-[var(--accent)]">.</span>
          </span>
          <span className="pl-2.5 border-l border-[var(--line-2)]">© {year}</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Footer">
          <button type="button" onClick={() => onOpenWatchDemo('standard')} className="hover:text-[var(--ink)] transition-colors cursor-pointer">
            Broadcast demo
          </button>
          <button type="button" onClick={() => onOpenWatchDemo('shop')} className="hover:text-[var(--ink)] transition-colors cursor-pointer">
            Live Shop demo
          </button>
          <button type="button" onClick={() => onOpenWatchDemo('gamer')} className="hover:text-[var(--ink)] transition-colors cursor-pointer">
            Gaming demo
          </button>
        </nav>
      </footer>
    </div>
  );
};
