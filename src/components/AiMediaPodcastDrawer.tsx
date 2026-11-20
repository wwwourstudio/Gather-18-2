import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Film,
  FolderHeart,
  Image as ImageIcon,
  Layers,
  Loader2,
  Mic,
  Music2,
  Play,
  Radio,
  Rss,
  Scissors,
  Sparkles,
  Square,
  Store,
  Trash2,
  Tv,
  Upload,
  Volume2,
  Wand2,
  X,
} from 'lucide-react';
import {
  AiMotionBumperSpec,
  AiMusicSpec,
  BrandBannerPreset,
  BrandKit,
  BrandKitProductDraft,
  MagicClipSuggestion,
  MediaAsset,
  NameTagStyle,
  OverlayGenMode,
  PodcastDirectoryStatus,
  PodcastShowConfig,
  RoomState,
  SlideAiCue,
  StageFontPreset,
  StageFrameStyle,
} from '../types/studio';
import {
  base64WavToBlob,
  renderMotionBumperToWebm,
  renderMusicSpecToWavBlob,
  renderSvgToPngDataUrl,
  sanitizeSvg,
  svgToCompactDataUrl,
} from '../utils/aiGraphicRenderer';
import { saveMediaAssetBlob } from '../utils/aiMediaStore';
import { audioEngine } from '../utils/audioEngine';
import {
  blobToBase64,
  convertBlobToWav,
  synthesizeSamplePodcastEpisodeWav,
} from '../utils/wavEncoder';

export type AiPodcastTab =
  | 'pdf'
  | 'graphics'
  | 'kits'
  | 'audio'
  | 'bumper'
  | 'clips'
  | 'podcast';

interface AiMediaPodcastDrawerProps {
  open: boolean;
  initialTab: AiPodcastTab;
  onClose: () => void;
  room: RoomState;
  activeMedia: MediaAsset | null;
  localStream: MediaStream | null;
  onUploadMediaFile: (file: File) => void;
  onAttachSlideCues: (cues: SlideAiCue[], fullScript: string) => void;
  onSelectSlide: (pageIndex: number) => void;
  onOpenTeleprompterWithScript: (script: string) => void;
  onApplyBackdropUrl: (dataUrl: string) => void;
  onApplyOverlayUrl: (dataUrl: string) => void;
  onApplyLogoUrl?: (dataUrl: string) => void;
  brandKits?: BrandKit[];
  onSaveBrandKit?: (kit: BrandKit) => Promise<void> | void;
  onApplyBrandKit?: (kit: BrandKit, options?: { openShop?: boolean }) => void;
  onDeleteBrandKit?: (kitId: string) => Promise<void> | void;
  onPushBanner: (title: string, subtitle: string) => void;
  onLaunchPoll: (question: string, options: string[]) => void;
  onCreateClipMarker: (label: string, timestampSec: number) => void;
  onExportReplayClip: () => void;
  onToast: (msg: string) => void;
}

const DIRECTORY_LABELS: Record<
  PodcastDirectoryStatus['platform'],
  { name: string; subtitle: string }
> = {
  spotify: { name: 'Spotify for Creators', subtitle: 'Auto-ingests WAV enclosures via RSS' },
  apple: { name: 'Apple Podcasts Connect', subtitle: 'iTunes 2.0 compliant episode tags' },
  amazon: { name: 'Amazon Music & Audible', subtitle: 'Direct syndication feed sync' },
  youtube: { name: 'YouTube Music Podcasts', subtitle: 'RSS audio-to-episode ingestion' },
};

type AiToolGroup = 'Prepare' | 'Design' | 'Sound' | 'After the show';

const AI_TOOL_GROUPS: AiToolGroup[] = ['Prepare', 'Design', 'Sound', 'After the show'];

const AI_TOOLS: Array<{
  id: AiPodcastTab;
  group: AiToolGroup;
  label: string;
  hint: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'pdf',
    group: 'Prepare',
    label: 'Slides & prompter',
    hint: 'Talking points from a PDF',
    description:
      'Upload a slide deck and get talking points, lower thirds and a teleprompter script for every slide.',
    icon: FileText,
  },
  {
    id: 'graphics',
    group: 'Design',
    label: 'Stage graphics',
    hint: 'Frames, backdrops, logos',
    description:
      'Describe a frame, backdrop, thumbnail or logo. Generate it, refine it in plain words, then put it on stage.',
    icon: Layers,
  },
  {
    id: 'kits',
    group: 'Design',
    label: 'Brand kits',
    hint: 'A full look in one go',
    description:
      'Describe your channel once and get a matching palette, fonts, logo, backdrop, overlay and starter products.',
    icon: Store,
  },
  {
    id: 'audio',
    group: 'Sound',
    label: 'Voice & music',
    hint: 'Intro drops and loops',
    description:
      'Turn a script into a voiced intro or promo, or generate a music loop. Both land in your stinger deck.',
    icon: Music2,
  },
  {
    id: 'bumper',
    group: 'Sound',
    label: 'Intro bumpers',
    hint: 'Starting soon, BRB, alerts',
    description:
      'Animated Starting Soon, Be Right Back and alert videos, rendered in your browser and ready to play on stage.',
    icon: Clapperboard,
  },
  {
    id: 'clips',
    group: 'After the show',
    label: 'Highlight clips',
    hint: 'Find the best moments',
    description:
      'Find the moments worth sharing from chat activity and your rundown, or drop in a video to play on stage.',
    icon: Scissors,
  },
  {
    id: 'podcast',
    group: 'After the show',
    label: 'Podcast',
    hint: 'Record and publish audio',
    description:
      'Record the show as audio, publish episodes, and share one RSS feed with Spotify, Apple Podcasts and more.',
    icon: Rss,
  },
];

const KIT_EXAMPLES: Record<BrandKit['niche'], string[]> = {
  gaming: ['Tactical FPS squad, neon cyan on black', 'Cozy farming-sim streamer, pastel greens'],
  commerce: ['Small-batch ceramics, warm clay and cream', 'Streetwear drops, bold red and concrete grey'],
  creator: ['Design teardown show, clean editorial monochrome', 'Cooking channel, sunny citrus palette'],
  podcast: ['Tech interview podcast, deep navy and brass', 'True-crime audio show, noir with one red accent'],
};

// Tools that call the AI endpoints; the podcast feed and clip uploads work without a key.
const AI_POWERED_TOOLS = new Set<AiPodcastTab>(['pdf', 'graphics', 'kits', 'audio', 'bumper', 'clips']);

type AiStatus = 'checking' | 'ready' | 'missing-key' | 'offline';

const AiStatusPill: React.FC<{ status: AiStatus }> = ({ status }) => {
  const map: Record<AiStatus, { label: string; dot: string; title: string }> = {
    checking: { label: 'Checking AI', dot: 'bg-[var(--ink-3)] animate-pulse', title: 'Checking the AI service…' },
    ready: { label: 'AI ready', dot: 'bg-[var(--ok)]', title: 'AI generation is available.' },
    'missing-key': {
      label: 'AI not set up',
      dot: 'bg-[var(--warn)]',
      title: 'The server has no GEMINI_API_KEY, so AI generation is unavailable.',
    },
    offline: { label: 'AI offline', dot: 'bg-[var(--danger)]', title: 'The AI service could not be reached.' },
  };
  const m = map[status];
  return (
    <span
      title={m.title}
      className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[var(--line-2)] bg-[var(--fill)] text-[11.5px] font-medium text-[var(--ink-2)] whitespace-nowrap"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} aria-hidden="true" />
      {m.label}
    </span>
  );
};

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const AiMediaPodcastDrawer: React.FC<AiMediaPodcastDrawerProps> = ({
  open,
  initialTab,
  onClose,
  room,
  activeMedia,
  localStream,
  onUploadMediaFile,
  onAttachSlideCues,
  onSelectSlide,
  onOpenTeleprompterWithScript,
  onApplyBackdropUrl,
  onApplyOverlayUrl,
  onApplyLogoUrl,
  brandKits = [],
  onSaveBrandKit,
  onApplyBrandKit,
  onDeleteBrandKit,
  onPushBanner,
  onLaunchPoll,
  onCreateClipMarker,
  onExportReplayClip,
  onToast,
}) => {
  const [tab, setTab] = useState<AiPodcastTab>(initialTab);

  // Tab 1: AI PDF & Teleprompter
  const [pdfAnalyzing, setPdfAnalyzing] = useState(false);
  const [pdfSummary, setPdfSummary] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Tab 2: AI Gaming HUDs, Webcam Frames & Stage Art
  const [graphicMode, setGraphicMode] = useState<OverlayGenMode>('hud-frame');
  const [graphicPrompt, setGraphicPrompt] = useState(
    'Cyber cobalt esports tactical HUD bezel with angled corner chamfers, glowing sponsor slot, and clear middle viewport'
  );
  const [graphicRefinePrompt, setGraphicRefinePrompt] = useState('');
  const [graphicLoading, setGraphicLoading] = useState(false);
  const [graphicTitle, setGraphicTitle] = useState<string>('');
  const [graphicSvg, setGraphicSvg] = useState<string>('');
  const [graphicPreviewUrl, setGraphicPreviewUrl] = useState<string>('');
  const [graphicError, setGraphicError] = useState<string | null>(null);

  // Tab 3: AI Brand Kits & Store Builder
  const [kitNiche, setKitNiche] = useState<BrandKit['niche']>('gaming');
  const [kitConcept, setKitConcept] = useState('');
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [draftKit, setDraftKit] = useState<BrandKit | null>(null);
  const [savingKitId, setSavingKitId] = useState<string | null>(null);

  // Tab 4: Gemini 3.8 Voice Stingers & AI Music Loops
  const [voiceScript, setVoiceScript] = useState(
    'Host: Welcome back to the live arena — new limited drops just unlocked below!\nCoHost: |yeah| Grab yours before the timer hits zero!'
  );
  const [voiceName, setVoiceName] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Kore');
  const [secondVoiceName, setSecondVoiceName] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Puck');
  const [voiceMood, setVoiceMood] = useState('Crisp energetic esports announcer');
  const [dualSpeaker, setDualSpeaker] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string>('');
  const [voiceTitle, setVoiceTitle] = useState<string>('');

  const [musicPrompt, setMusicPrompt] = useState('Warm nocturnal lo-fi synth & deep sub pulse');
  const [musicMood, setMusicMood] = useState<'lofi' | 'esports' | 'synthwave' | 'keynote'>('lofi');
  const [musicDuration, setMusicDuration] = useState<number>(8);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicSpec, setMusicSpec] = useState<AiMusicSpec | null>(null);
  const [musicBlob, setMusicBlob] = useState<Blob | null>(null);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string>('');

  // Tab 5: AI Kinetic Motion Bumpers
  const [bumperType, setBumperType] = useState<'starting-soon' | 'be-right-back' | 'stream-ending' | 'drop-alert'>('starting-soon');
  const [bumperAspect, setBumperAspect] = useState<'16:9' | '9:16'>('16:9');
  const [bumperDuration, setBumperDuration] = useState<number>(5);
  const [bumperPrompt, setBumperPrompt] = useState('Starting Soon architectural cobalt light rays with crisp countdown pulse');
  const [bumperLoading, setBumperLoading] = useState(false);
  const [bumperError, setBumperError] = useState<string | null>(null);
  const [bumperSpec, setBumperSpec] = useState<AiMotionBumperSpec | null>(null);
  const [bumperFile, setBumperFile] = useState<File | null>(null);
  const [bumperVideoUrl, setBumperVideoUrl] = useState<string>('');

  // Tab 6: AI Video & Magic Clips
  const [clipsLoading, setClipsLoading] = useState(false);
  const [magicClips, setMagicClips] = useState<MagicClipSuggestion[]>([]);
  const [clipsError, setClipsError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Tab 4: Podcast RSS & WAV Hub
  const podcastSlug = 'gather-live';
  const [podcastShow, setPodcastShow] = useState<PodcastShowConfig | null>(null);
  const [podcastLoading, setPodcastLoading] = useState(false);
  const [showRssPreview, setShowRssPreview] = useState(false);
  const [rssXmlText, setRssXmlText] = useState('');
  const [copiedRss, setCopiedRss] = useState(false);

  // Audio-only Master Bus WAV recorder
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordElapsedSec, setRecordElapsedSec] = useState(0);
  const [recordedWavBlob, setRecordedWavBlob] = useState<Blob | null>(null);
  const [recordedWavUrl, setRecordedWavUrl] = useState<string>('');
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeSummary, setEpisodeSummary] = useState('');
  const [publishingEpisode, setPublishingEpisode] = useState(false);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const audioUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  const [aiStatus, setAiStatus] = useState<AiStatus>('checking');
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((h: { ai?: boolean }) => {
        if (!cancelled) setAiStatus(h.ai ? 'ready' : 'missing-key');
      })
      .catch(() => {
        if (!cancelled) setAiStatus('offline');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setEpisodeTitle((prev) => prev || `${room.title} — Live Audio Edition`);
    setEpisodeSummary(
      (prev) =>
        prev ||
        `Recorded live in Gather Studio (${room.roomCode}) with uncompressed 16-bit PCM WAV mastering.`
    );
  }, [open, room.title, room.roomCode]);

  const fetchPodcastShow = async () => {
    setPodcastLoading(true);
    try {
      const res = await fetch(`/api/podcast/${podcastSlug}`);
      if (res.ok) {
        const data = (await res.json()) as PodcastShowConfig;
        setPodcastShow(data);
      }
    } catch {
      // ignore transient error
    } finally {
      setPodcastLoading(false);
    }
  };

  useEffect(() => {
    if (open && tab === 'podcast') {
      void fetchPodcastShow();
    }
  }, [open, tab]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
      if (musicAudioUrl) URL.revokeObjectURL(musicAudioUrl);
      if (bumperVideoUrl) URL.revokeObjectURL(bumperVideoUrl);
    };
  }, [recordedWavUrl, musicAudioUrl, bumperVideoUrl]);

  if (!open) return null;

  const rssUrl = `${window.location.origin}/api/podcast/${podcastSlug}/rss.xml`;

  // --- Handlers: Tab 1 (AI PDF & Slide Analyzer) ---
  const handleAnalyzeActivePdf = async () => {
    if (!activeMedia || activeMedia.kind !== 'pdf') {
      setPdfError('Upload a PDF slide deck first to generate talking points and teleprompter cues.');
      return;
    }
    setPdfAnalyzing(true);
    setPdfError(null);
    try {
      const slidesPayload =
        activeMedia.slideTexts && activeMedia.slideTexts.length > 0
          ? activeMedia.slideTexts.map((text, idx) => ({
              pageNumber: idx + 1,
              text: text || `Slide ${idx + 1} of ${activeMedia.name}`,
            }))
          : Array.from({ length: activeMedia.totalPages }, (_, idx) => ({
              pageNumber: idx + 1,
              text: `Slide ${idx + 1} from presentation ${activeMedia.name}`,
            }));

      const res = await fetch('/api/ai/pdf-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckName: activeMedia.name,
          showTitle: room.title,
          slideTexts: slidesPayload.map((s) => s.text),
          slides: slidesPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze PDF deck');
      }
      const cues = (data.cues || []) as SlideAiCue[];
      const combinedScript =
        String(data.fullTeleprompterScript || '').trim() ||
        cues.map((c) => `[Slide ${c.pageNumber}: ${c.slideTitle}]\n${c.teleprompterScript}`).join('\n\n');

      setPdfSummary(String(data.executiveSummary || ''));
      onAttachSlideCues(cues, combinedScript);
      onToast(`Analyzed ${cues.length} slides and synced Eye-Line Prompter.`);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF analysis failed.');
    } finally {
      setPdfAnalyzing(false);
    }
  };

  // --- Handlers: Tab 2 (AI HUDs, Webcam Frames & Stage Art) ---
  const getDimensionsForMode = (mode: OverlayGenMode): { w: number; h: number; transparent: boolean } => {
    if (mode === 'logo') return { w: 512, h: 512, transparent: true };
    if (mode === 'podcast-cover') return { w: 1400, h: 1400, transparent: false };
    if (mode === 'hud-frame' || mode === 'webcam-frame') return { w: 1920, h: 1080, transparent: true };
    return { w: 1920, h: 1080, transparent: false };
  };

  const handleGenerateGraphic = async () => {
    if (!graphicPrompt.trim()) return;
    setGraphicLoading(true);
    setGraphicError(null);
    try {
      const res = await fetch('/api/ai/overlay-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: graphicMode,
          prompt: graphicPrompt.trim(),
          showTitle: room.title,
          primaryHex: room.brand.accent,
          secondaryHex: '#38BDF8',
          aspectRatio: '16:9',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate stage vector graphic');
      }
      const dims = getDimensionsForMode(graphicMode);
      const cleanSvg = sanitizeSvg(String(data.svg || ''), dims.w, dims.h);
      setGraphicSvg(cleanSvg);
      setGraphicTitle(String(data.title || 'AI Broadcast Graphic'));
      setGraphicPreviewUrl(svgToCompactDataUrl(cleanSvg));
    } catch (err) {
      setGraphicError(err instanceof Error ? err.message : 'Graphic generation failed.');
    } finally {
      setGraphicLoading(false);
    }
  };

  const handleRefineGraphic = async () => {
    if (!graphicSvg || !graphicRefinePrompt.trim()) return;
    setGraphicLoading(true);
    setGraphicError(null);
    try {
      const res = await fetch('/api/ai/overlay-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          svg: graphicSvg,
          instruction: graphicRefinePrompt.trim(),
          mode: graphicMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to refine vector graphic.');
      const dims = getDimensionsForMode(graphicMode);
      const cleanSvg = sanitizeSvg(String(data.svg || ''), dims.w, dims.h);
      setGraphicSvg(cleanSvg);
      setGraphicPreviewUrl(svgToCompactDataUrl(cleanSvg));
      setGraphicRefinePrompt('');
      onToast('Graphic refined.');
    } catch (err) {
      setGraphicError(err instanceof Error ? err.message : 'Vector refinement failed.');
    } finally {
      setGraphicLoading(false);
    }
  };

  const handleApplyGraphic = async () => {
    if (!graphicPreviewUrl) return;
    if (graphicMode === 'backdrop' || graphicMode === 'thumbnail') {
      onApplyBackdropUrl(graphicPreviewUrl);
      onToast('Applied AI backdrop to broadcast stage.');
    } else if (graphicMode === 'logo') {
      onApplyLogoUrl?.(graphicPreviewUrl);
      onToast('Applied AI corner watermark logo.');
    } else if (graphicMode === 'hud-frame' || graphicMode === 'webcam-frame') {
      onApplyOverlayUrl(graphicPreviewUrl);
      onToast(
        graphicMode === 'hud-frame'
          ? 'Applied transparent AI Gaming HUD frame overlay.'
          : 'Applied transparent AI Webcam frame overlay.'
      );
    } else if (graphicMode === 'podcast-cover') {
      const png1400 = await renderSvgToPngDataUrl(graphicSvg, 1400, 1400, false);
      await fetch(`/api/podcast/${podcastSlug}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverArtUrl: png1400 }),
      });
      await fetchPodcastShow();
      onToast('Updated Podcast RSS 1400×1400 cover art.');
    }
  };

  const handleDownloadGraphic = async () => {
    if (!graphicSvg) return;
    const dims = getDimensionsForMode(graphicMode);
    const pngUrl = await renderSvgToPngDataUrl(graphicSvg, dims.w, dims.h, dims.transparent);
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `gather-${graphicMode}-${Date.now()}.png`;
    a.click();
  };

  const handleSaveGraphicAsKit = async () => {
    if (!onSaveBrandKit || !graphicPreviewUrl) return;
    const kit: BrandKit = {
      id: `kit-${Date.now().toString(36)}`,
      name: graphicTitle || `AI ${graphicMode} Kit`,
      niche: graphicMode === 'hud-frame' ? 'gaming' : graphicMode === 'podcast-cover' ? 'podcast' : 'creator',
      storeName: room.commerce.storeLabel || room.title || 'Gather Studio',
      storeTagline: 'Saved from AI Stage Designer',
      accentHex: room.brand.accent,
      secondaryHex: '#38BDF8',
      backdropPreset: room.brand.backdrop,
      stageFont: 'Plus Jakarta Sans',
      frameStyle: 'rounded',
      nameTagStyle: room.brand.nameTagStyle || 'glass',
      bannerStyle: 'classic',
      bannerTitle: room.overlays.banner.title || room.title,
      bannerSubtitle: room.overlays.banner.subtitle || '',
      logoUrl: graphicMode === 'logo' ? graphicPreviewUrl : room.brand.logoUrl || '',
      backdropUrl:
        graphicMode === 'backdrop' || graphicMode === 'thumbnail'
          ? graphicPreviewUrl
          : room.brand.customBackdropUrl || '',
      overlayUrl:
        graphicMode === 'hud-frame' || graphicMode === 'webcam-frame'
          ? graphicPreviewUrl
          : room.brand.customOverlayUrl || '',
      products: [],
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    setSavingKitId(kit.id);
    try {
      await onSaveBrandKit(kit);
    } finally {
      setSavingKitId(null);
    }
  };

  // --- Handlers: Tab 3 (AI Brand Kits) ---
  const handleGenerateBrandKit = async () => {
    if (!kitConcept.trim()) return;
    setKitLoading(true);
    setKitError(null);
    try {
      const res = await fetch('/api/ai/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: kitConcept.trim(),
          niche: kitNiche,
          showTitle: room.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate AI Brand Kit.');

      const logoUrl = svgToCompactDataUrl(sanitizeSvg(String(data.logoSvg || ''), 512, 512));
      const backdropUrl = svgToCompactDataUrl(sanitizeSvg(String(data.backdropSvg || ''), 1920, 1080));
      const overlayUrl = svgToCompactDataUrl(sanitizeSvg(String(data.overlaySvg || ''), 1920, 1080));
      const rawProducts = Array.isArray(data.products) ? data.products : [];
      const products: BrandKitProductDraft[] = rawProducts.slice(0, 3).map((item: Record<string, unknown>, idx: number) => {
        const cleanSvg = sanitizeSvg(String(item.productSvg || ''), 512, 512);
        return {
          id: `ai-prod-${Date.now().toString(36)}-${idx + 1}`,
          title: String(item.title || `Featured Drop #${idx + 1}`),
          price: Math.max(1, Number(item.price || 48)),
          category: String(item.category || 'Limited Drop'),
          description: String(item.description || 'AI-curated studio drop item.'),
          variants: Array.isArray(item.variants)
            ? item.variants.slice(0, 4).map((v) => String(v))
            : ['Standard'],
          imageUrl: svgToCompactDataUrl(cleanSvg),
          svg: cleanSvg,
        };
      });

      const createdKit: BrandKit = {
        id: `kit-${Date.now().toString(36)}`,
        name: String(data.name || 'Custom Brand Kit'),
        niche: kitNiche,
        storeName: String(data.storeName || room.title || 'Gather Store'),
        storeTagline: String(data.storeTagline || 'Curated live broadcast drop'),
        accentHex: String(data.accentHex || room.brand.accent),
        secondaryHex: String(data.secondaryHex || '#38BDF8'),
        backdropPreset: (String(data.backdropPreset || 'dusk') as BrandKit['backdropPreset']),
        stageFont: (String(data.stageFont || 'Plus Jakarta Sans') as StageFontPreset),
        frameStyle: (String(data.frameStyle || 'rounded') as StageFrameStyle),
        nameTagStyle: (String(data.nameTagStyle || 'glass') as NameTagStyle),
        bannerStyle: (String(data.bannerStyle || 'classic') as BrandBannerPreset),
        bannerTitle: String(data.bannerTitle || data.storeName || room.title),
        bannerSubtitle: String(data.bannerSubtitle || data.storeTagline || 'Live on Gather'),
        logoUrl,
        backdropUrl,
        overlayUrl,
        gamerHud: data.gamerHud,
        products,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };
      setDraftKit(createdKit);
    } catch (err) {
      setKitError(err instanceof Error ? err.message : 'Unable to create AI Brand Kit.');
    } finally {
      setKitLoading(false);
    }
  };

  // --- Handlers: Tab 4 (Gemini 3.8 Voice Stingers & AI Music Loops) ---
  const handleGenerateVoiceStinger = async () => {
    if (!voiceScript.trim()) return;
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const res = await fetch('/api/ai/voice-stinger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: voiceScript.trim(),
          voiceName,
          secondVoiceName,
          mood: voiceMood.trim(),
          dualSpeaker,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Voice stinger generation failed.');
      setVoiceAudioUrl(String(data.audioDataUrl || ''));
      setVoiceTitle(String(data.title || 'AI Voice Stinger'));
      onToast(`Generated ${dualSpeaker ? 'dual-speaker' : voiceName} broadcast stinger.`);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Voice generation failed.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleLoadVoiceToDeck = async () => {
    if (!voiceAudioUrl) return;
    const blob = base64WavToBlob(voiceAudioUrl);
    const label = (voiceTitle || `AI ${voiceName} Drop`).slice(0, 28);
    const item = await audioEngine.loadCustomAudioBlob(blob, label, 'ai-voice', false);
    await saveMediaAssetBlob(`voice:${item.id}`, blob);
    onToast(`Added "${item.name}" to your Stinger Deck.`);
  };

  const handleGenerateMusicLoop = async () => {
    if (!musicPrompt.trim()) return;
    setMusicLoading(true);
    setMusicError(null);
    try {
      const res = await fetch('/api/ai/music-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt.trim(),
          mood: musicMood,
          durationSec: musicDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Music composition request failed.');
      const spec = data.spec as AiMusicSpec;
      const wavBlob = await renderMusicSpecToWavBlob(spec);
      if (musicAudioUrl) URL.revokeObjectURL(musicAudioUrl);
      const nextUrl = URL.createObjectURL(wavBlob);
      setMusicSpec(spec);
      setMusicBlob(wavBlob);
      setMusicAudioUrl(nextUrl);
      onToast(`Composed "${spec.title}" (${spec.bpm} BPM stereo WAV loop).`);
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : 'AI music loop creation failed.');
    } finally {
      setMusicLoading(false);
    }
  };

  const handleLoadMusicToDeck = async () => {
    if (!musicBlob || !musicSpec) return;
    const item = await audioEngine.loadCustomAudioBlob(musicBlob, musicSpec.title, 'ai-music', true);
    await saveMediaAssetBlob(`music:${item.id}`, musicBlob);
    onToast(`Added looping bed "${item.name}" to Stinger Deck.`);
  };

  // --- Handlers: Tab 5 (Kinetic WebM Motion Bumpers) ---
  const handleGenerateMotionBumper = async () => {
    if (!bumperPrompt.trim()) return;
    setBumperLoading(true);
    setBumperError(null);
    try {
      const res = await fetch('/api/ai/motion-bumper-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: bumperPrompt.trim(),
          bumperType,
          showTitle: room.title,
          accentHex: room.brand.accent,
          aspectRatio: bumperAspect,
          durationSec: bumperDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Motion bumper design failed.');
      const spec = data.spec as AiMotionBumperSpec;
      setBumperSpec(spec);
      const file = await renderMotionBumperToWebm(spec);
      if (bumperVideoUrl) URL.revokeObjectURL(bumperVideoUrl);
      const nextUrl = URL.createObjectURL(file);
      setBumperFile(file);
      setBumperVideoUrl(nextUrl);
      onToast(`Rendered "${spec.title}" (${spec.aspectRatio} WebM bumper).`);
    } catch (err) {
      setBumperError(err instanceof Error ? err.message : 'Unable to generate motion bumper.');
    } finally {
      setBumperLoading(false);
    }
  };

  // --- Handlers: Tab 3 (AI Video & Magic Clips) ---
  const handleDetectMagicClips = async () => {
    setClipsLoading(true);
    setClipsError(null);
    try {
      const elapsedSec = room.liveStartedAt
        ? Math.max(60, Math.floor((Date.now() - room.liveStartedAt) / 1000))
        : 420;
      const res = await fetch('/api/ai/magic-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showTitle: room.title,
          videoName: activeMedia?.kind === 'video' ? activeMedia.name : undefined,
          elapsedSec,
          chatHighlights: room.chatMessages.slice(-16).map((m) => `${m.author}: ${m.text}`),
          rundownSteps: room.rundown.steps.map((s) => s.title),
          existingClips: room.gamer.clips.map((c) => `${c.label} @ ${c.timestampSec}s`),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to detect magic clips');
      }
      setMagicClips((data.clips || []) as MagicClipSuggestion[]);
    } catch (err) {
      setClipsError(err instanceof Error ? err.message : 'Magic Clips detection failed.');
    } finally {
      setClipsLoading(false);
    }
  };

  // --- Handlers: Tab 4 (Podcast Master Bus WAV & RSS) ---
  const startAudioRecording = async () => {
    try {
      const masterStream = audioEngine.getMasterStream();
      let targetStream: MediaStream | null = null;
      if (masterStream && masterStream.getAudioTracks().length > 0) {
        targetStream = new MediaStream(masterStream.getAudioTracks());
      } else if (localStream && localStream.getAudioTracks().length > 0) {
        targetStream = new MediaStream(localStream.getAudioTracks());
      } else {
        targetStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      audioChunksRef.current = [];
      const rec = new MediaRecorder(targetStream);
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setIsRecordingAudio(false);
        try {
          const rawBlob = new Blob(audioChunksRef.current, {
            type: rec.mimeType || 'audio/webm',
          });
          const { wavBlob, durationSec } = await convertBlobToWav(rawBlob);
          if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
          const nextUrl = URL.createObjectURL(wavBlob);
          setRecordedWavBlob(wavBlob);
          setRecordedWavUrl(nextUrl);
          setRecordedDurationSec(durationSec);
          onToast(`Mastered ${durationSec}s 16-bit PCM WAV episode.`);
        } catch {
          onToast('Unable to decode recorded audio.');
        }
      };

      rec.start(250);
      audioRecorderRef.current = rec;
      setRecordElapsedSec(0);
      setIsRecordingAudio(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordElapsedSec((s) => s + 1);
      }, 1000);
    } catch {
      onToast('Microphone or Master Bus audio stream unavailable.');
    }
  };

  const stopAudioRecording = () => {
    const rec = audioRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
  };

  const handleAudioFileUpload = async (file: File) => {
    try {
      const { wavBlob, durationSec } = await convertBlobToWav(file);
      if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
      const nextUrl = URL.createObjectURL(wavBlob);
      setRecordedWavBlob(wavBlob);
      setRecordedWavUrl(nextUrl);
      setRecordedDurationSec(durationSec);
      setEpisodeTitle(file.name.replace(/\.[^.]+$/, ''));
      onToast(`Converted "${file.name}" to broadcast 16-bit PCM WAV.`);
    } catch {
      onToast('Could not transcode uploaded audio file.');
    }
  };

  const handleSynthesizeTestWav = () => {
    const wavBlob = synthesizeSamplePodcastEpisodeWav(8);
    if (recordedWavUrl) URL.revokeObjectURL(recordedWavUrl);
    const nextUrl = URL.createObjectURL(wavBlob);
    setRecordedWavBlob(wavBlob);
    setRecordedWavUrl(nextUrl);
    setRecordedDurationSec(8);
    onToast('Generated 8s stereo WAV studio check clip.');
  };

  const handleDownloadWav = () => {
    if (!recordedWavUrl) return;
    const a = document.createElement('a');
    a.href = recordedWavUrl;
    a.download = `${(episodeTitle || 'gather-episode').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`;
    a.click();
  };

  const handlePublishEpisodeToRss = async () => {
    const blobToPublish = recordedWavBlob || synthesizeSamplePodcastEpisodeWav(8);
    const dur = recordedWavBlob ? recordedDurationSec : 8;
    setPublishingEpisode(true);
    try {
      const audioBase64 = await blobToBase64(blobToPublish);
      const res = await fetch(`/api/podcast/${podcastSlug}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: episodeTitle.trim() || `${room.title} — Live Episode`,
          summary:
            episodeSummary.trim() ||
            `Recorded live in Gather Studio (${room.roomCode}) and distributed via Gather RSS.`,
          durationSec: dur,
          audioBase64,
        }),
      });
      if (!res.ok) throw new Error('Publish failed');
      await fetchPodcastShow();
      onToast('Published WAV episode to live Gather Podcast RSS feed!');
    } catch {
      onToast('Failed to publish episode to RSS feed.');
    } finally {
      setPublishingEpisode(false);
    }
  };

  const handleToggleDirectory = async (platform: PodcastDirectoryStatus['platform']) => {
    if (!podcastShow) return;
    const nextDirs = podcastShow.directories.map((d) =>
      d.platform === platform ? { ...d, connected: !d.connected } : d
    );
    const res = await fetch(`/api/podcast/${podcastSlug}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directories: nextDirs }),
    });
    if (res.ok) {
      const updated = (await res.json()) as PodcastShowConfig;
      setPodcastShow(updated);
      const target = updated.directories.find((d) => d.platform === platform);
      onToast(
        `${DIRECTORY_LABELS[platform].name} ${
          target?.connected ? 'connected to auto-sync RSS' : 'paused'
        }.`
      );
    }
  };

  const handleLoadRssXml = async () => {
    if (showRssPreview) {
      setShowRssPreview(false);
      return;
    }
    const res = await fetch(`/api/podcast/${podcastSlug}/rss.xml`);
    const xml = await res.text();
    setRssXmlText(xml);
    setShowRssPreview(true);
  };

  const secondaryBtnCls =
    'h-8 px-3 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[11.5px] font-semibold text-[var(--ink)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors';

  const primaryBtnCls =
    'h-8 px-3.5 rounded-[8px] gather-btn-primary text-[11.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45';

  const inputCls =
    'h-9 rounded-[9px] bg-[var(--fill)] border border-[var(--line-2)] px-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]';

  const activeTool = AI_TOOLS.find((t) => t.id === tab) || AI_TOOLS[0];
  const ActiveIcon = activeTool.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 gather-lightbox-scrim animate-gather-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-studio-title"
        className="w-full sm:w-[96%] max-w-[1180px] h-full sm:h-[min(860px,92vh)] flex flex-col sm:rounded-[18px] gather-glass-elevated animate-gather-modal overflow-hidden"
      >
        {/* Header */}
        <header
          className="flex items-center justify-between gap-4 px-4 sm:px-5 h-14 border-b border-[var(--line)] shrink-0"
          style={{ backgroundColor: 'var(--elevated-header)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-line)] grid place-items-center shrink-0">
              <Wand2 className="w-4 h-4 text-[var(--accent-text)]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="ai-studio-title"
                className="font-display text-[15.5px] font-medium tracking-tight text-[var(--ink)] truncate"
              >
                AI Studio
              </h2>
              <p className="text-[11.5px] text-[var(--ink-3)] truncate">
                Create graphics, sound and show assets for {room.title || 'your show'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AiStatusPill status={aiStatus} />
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Close AI Studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Tool navigation: grouped sidebar on desktop, scrolling chips on mobile */}
          <nav
            aria-label="AI Studio tools"
            className="shrink-0 md:w-[232px] border-b md:border-b-0 md:border-r border-[var(--line)] overflow-x-auto md:overflow-y-auto gather-scroll"
            style={{ backgroundColor: 'var(--elevated-rail)' }}
          >
            <div className="flex md:flex-col gap-1 md:gap-5 p-2 md:p-3">
              {AI_TOOL_GROUPS.map((group) => (
                <div key={group} className="contents md:block md:space-y-1">
                  <div className="hidden md:block px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)]">
                    {group}
                  </div>
                  {AI_TOOLS.filter((t) => t.group === group).map((item) => {
                    const Icon = item.icon;
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setTab(item.id)}
                        className={`group shrink-0 md:w-full flex items-center gap-2.5 rounded-[9px] px-2.5 h-9 md:h-auto md:py-2 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                          active
                            ? 'bg-[var(--accent-soft)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--accent-line)]'
                            : 'text-[var(--ink-2)] hover:bg-[var(--fill-hover)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--accent-text)]' : 'text-[var(--ink-3)] group-hover:text-[var(--ink-2)]'}`}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-medium whitespace-nowrap">{item.label}</span>
                          <span className="hidden md:block text-[11px] text-[var(--ink-3)] leading-snug mt-0.5">
                            {item.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </nav>

          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            {/* Active tool header */}
            <div className="shrink-0 px-4 sm:px-6 pt-5 pb-4 border-b border-[var(--line)] flex items-start gap-3">
              <span className="hidden sm:grid w-10 h-10 rounded-[10px] bg-[var(--fill)] border border-[var(--line-2)] place-items-center shrink-0">
                <ActiveIcon className="w-5 h-5 text-[var(--accent-text)]" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-[18px] font-medium tracking-[-0.015em] text-[var(--ink)]">
                  {activeTool.label}
                </h3>
                <p className="text-[13px] text-[var(--ink-2)] leading-relaxed mt-0.5 max-w-[70ch]">
                  {activeTool.description}
                </p>
              </div>
            </div>

            {aiStatus === 'missing-key' && AI_POWERED_TOOLS.has(tab) && (
              <div className="shrink-0 mx-4 sm:mx-6 mt-4 p-3 rounded-[10px] border border-[var(--warn)]/35 bg-[var(--warn)]/10 flex items-start gap-2.5 text-[12.5px] text-[var(--ink)]">
                <Sparkles className="w-4 h-4 text-[var(--warn)] shrink-0 mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                  <span className="font-medium">AI generation isn&rsquo;t set up on this server yet.</span>{' '}
                  <span className="text-[var(--ink-2)]">
                    Add a <code className="font-mono-num text-[11.5px]">GEMINI_API_KEY</code> environment variable to the deployment, then reload. Everything else in the studio keeps working.
                  </span>
                </p>
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 gather-scroll">
          {/* TAB 1: AI PDF & TELEPROMPTER */}
          {tab === 'pdf' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)]">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[13.5px] font-medium text-[var(--ink)]">
                    {activeMedia?.kind === 'pdf'
                      ? `${activeMedia.name} · ${activeMedia.totalPages} slides on stage`
                      : 'PDF Slide Deck & Teleprompter Sync'}
                  </div>
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5 leading-relaxed">
                    Extract slide talking points, lower-thirds, and a voice-synced Eye-Line Prompter script in one click.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadMediaFile(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className={secondaryBtnCls}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{activeMedia?.kind === 'pdf' ? 'Replace PDF' : 'Upload PDF'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={pdfAnalyzing || activeMedia?.kind !== 'pdf'}
                    onClick={() => void handleAnalyzeActivePdf()}
                    className={primaryBtnCls}
                  >
                    {pdfAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{pdfAnalyzing ? 'Analyzing…' : 'Generate Talking Points'}</span>
                  </button>
                </div>
              </div>

              {pdfError && (
                <div className="p-3 rounded-[10px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[12px] text-[var(--danger)]">
                  {pdfError}
                </div>
              )}

              {pdfSummary && (
                <div className="p-4 rounded-[12px] bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-[12px] font-bold text-[var(--ink)]">
                      Deck summary
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const script =
                          activeMedia?.slideCues
                            ?.map(
                              (c) =>
                                `[Slide ${c.pageNumber}: ${c.slideTitle}]\n${c.teleprompterScript}`
                            )
                            .join('\n\n') || pdfSummary;
                        onOpenTeleprompterWithScript(script);
                        onClose();
                      }}
                      className="h-7 px-3 rounded-[7px] gather-btn-tip text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Mic className="w-3 h-3" />
                      <span>Open in teleprompter</span>
                    </button>
                  </div>
                  <p className="text-[12px] text-[var(--ink-2)] leading-relaxed">{pdfSummary}</p>
                </div>
              )}

              {activeMedia?.kind === 'pdf' && activeMedia.slideCues && activeMedia.slideCues.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeMedia.slideCues.map((cue) => (
                    <div
                      key={cue.pageNumber}
                      className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono-num font-semibold text-[var(--cyan)]">
                            Slide {cue.pageNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectSlide(cue.pageNumber - 1)}
                            className="text-[11px] font-semibold text-[var(--accent-text)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Show on Stage →
                          </button>
                        </div>
                        <h4 className="font-display text-[13.5px] font-semibold text-[var(--ink)]">
                          {cue.slideTitle}
                        </h4>
                        <ul className="space-y-1 text-[11.5px] text-[var(--ink-2)]">
                          {cue.talkingPoints.map((pt, i) => (
                            <li key={i}>· {pt}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() =>
                            onPushBanner(cue.suggestedBannerTitle, cue.suggestedBannerSub)
                          }
                          className="h-7 px-2.5 rounded-[7px] bg-[var(--surface)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Tv className="w-3 h-3" />
                          <span>Push Banner</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenTeleprompterWithScript(cue.teleprompterScript);
                            onClose();
                          }}
                          className="h-7 px-2.5 rounded-[7px] bg-[var(--surface)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Mic className="w-3 h-3" />
                          <span>Send to Prompter</span>
                        </button>
                        {cue.suggestedPollQuestion && (
                          <button
                            type="button"
                            onClick={() =>
                              onLaunchPoll(cue.suggestedPollQuestion!, [
                                'Strongly Agree',
                                'Curious to Try',
                                'Tell Me More',
                              ])
                            }
                            className="h-7 px-2.5 rounded-[7px] bg-[var(--surface)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Launch Poll
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[12px] bg-[var(--surface)]/50 border border-[var(--line)] text-center space-y-2.5">
                  <FileText className="w-6 h-6 mx-auto text-[var(--accent-text)] opacity-85" />
                  <p className="font-display text-[13px] font-semibold text-[var(--ink)]">
                    {activeMedia?.kind === 'pdf'
                      ? 'Deck ready — generate AI talking points'
                      : 'Ready for your slide deck or live script'}
                  </p>
                  <p className="text-[11.5px] text-[var(--ink-3)] max-w-md mx-auto leading-relaxed">
                    {activeMedia?.kind === 'pdf'
                      ? 'Click Generate Talking Points above to turn your slides into lower-third cues and a teleprompter script.'
                      : 'Upload any PDF deck above to extract talking points, or launch the Eye-Line Prompter directly.'}
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenTeleprompterWithScript('');
                        onClose();
                      }}
                      className={secondaryBtnCls}
                    >
                      <Mic className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>Open Eye-Line Prompter</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI GAMING HUD FRAMES, WEBCAM BEZELS, BACKDROPS & LOGOS */}
          {tab === 'graphics' && (
            <div className="space-y-4">
              <div className="gather-seg flex-wrap" role="tablist" aria-label="Graphic type">
                {(
                  [
                    { id: 'hud-frame', label: 'Game frame' },
                    { id: 'webcam-frame', label: 'Webcam frame' },
                    { id: 'backdrop', label: 'Backdrop' },
                    { id: 'thumbnail', label: 'Thumbnail' },
                    { id: 'logo', label: 'Logo' },
                    { id: 'podcast-cover', label: 'Podcast cover' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={graphicMode === m.id}
                    onClick={() => setGraphicMode(m.id)}
                    className={`gather-seg-btn ${graphicMode === m.id ? 'active' : ''}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: 'Esports frame',
                    mode: 'hud-frame' as OverlayGenMode,
                    prompt: 'Carbon esports tactical HUD perimeter frame with top match telemetry bar and glowing chamfer corners',
                  },
                  {
                    label: 'Webcam bezel',
                    mode: 'webcam-frame' as OverlayGenMode,
                    prompt: 'Sleek translucent cyber neon webcam bezel with twin side meters and clean center cutout',
                  },
                  {
                    label: 'Studio backdrop',
                    mode: 'backdrop' as OverlayGenMode,
                    prompt: 'Refined midnight obsidian studio with soft radial light beams and crisp grid depth',
                  },
                  {
                    label: 'Emblem logo',
                    mode: 'logo' as OverlayGenMode,
                    prompt: 'Minimalist geometric broadcast emblem monogram with dual tone ring and precision symmetry',
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setGraphicMode(preset.mode);
                      setGraphicPrompt(preset.prompt);
                    }}
                    className="h-7 px-2.5 rounded-[7px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)] whitespace-nowrap cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={graphicPrompt}
                  onChange={(e) => setGraphicPrompt(e.target.value)}
                  placeholder="Describe your gaming HUD overlay, camera frame, backdrop, or logo..."
                  className={`${inputCls} w-full sm:flex-1`}
                />
                <button
                  type="button"
                  disabled={graphicLoading}
                  onClick={() => void handleGenerateGraphic()}
                  className={`${primaryBtnCls} h-9`}
                >
                  {graphicLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{graphicLoading ? 'Designing…' : 'Generate'}</span>
                </button>
              </div>

              {graphicError && (
                <div className="p-3 rounded-[10px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[12px] text-[var(--danger)]">
                  {graphicError}
                </div>
              )}

              {graphicPreviewUrl ? (
                <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[12px] text-[var(--ink-2)]">
                      <span className="font-medium text-[var(--ink)]">
                        {graphicTitle || 'Custom Broadcast Vector Asset'}
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono-num">
                        {graphicMode === 'logo'
                          ? '512×512 Transparent'
                          : graphicMode === 'podcast-cover'
                            ? '1400×1400 Cover'
                            : '1920×1080 HD'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {onSaveBrandKit && (
                        <button
                          type="button"
                          onClick={() => void handleSaveGraphicAsKit()}
                          className={secondaryBtnCls}
                        >
                          <FolderHeart className="w-3.5 h-3.5 text-[var(--cyan)]" />
                          <span>Save as Kit</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDownloadGraphic()}
                        className={secondaryBtnCls}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleApplyGraphic()}
                        className="h-8 px-3.5 rounded-[8px] gather-btn-tip text-[11.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {graphicMode === 'podcast-cover'
                            ? 'Set Podcast Cover'
                            : graphicMode === 'logo'
                              ? 'Set Corner Logo'
                              : graphicMode === 'hud-frame' || graphicMode === 'webcam-frame'
                                ? 'Apply Transparent Frame'
                                : 'Apply to Stage'}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div
                    className="rounded-[10px] overflow-hidden border border-[var(--line)] flex items-center justify-center max-h-72 p-3"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, rgba(148,163,184,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.08) 75%)',
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
                    }}
                  >
                    <img
                      src={graphicPreviewUrl}
                      alt="Generated broadcast graphic preview"
                      className="max-h-64 w-auto object-contain"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={graphicRefinePrompt}
                      onChange={(e) => setGraphicRefinePrompt(e.target.value)}
                      placeholder="Describe a change, e.g. thicker glow on the top edge, sharper corners"
                      className={`${inputCls} w-full sm:flex-1`}
                    />
                    <button
                      type="button"
                      disabled={graphicLoading || !graphicRefinePrompt.trim()}
                      onClick={() => void handleRefineGraphic()}
                      className={secondaryBtnCls}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>Refine Vector</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[12px] bg-[var(--surface)]/50 border border-[var(--line)] text-center space-y-2">
                  <ImageIcon className="w-6 h-6 mx-auto text-[var(--accent-text)] opacity-85" />
                  <p className="font-display text-[13px] font-medium text-[var(--ink)]">
                    Your graphic will appear here
                  </p>
                  <p className="text-[11.5px] text-[var(--ink-3)] max-w-md mx-auto leading-relaxed">
                    Graphics are vector (SVG), so they stay sharp at any size. Frames keep a transparent centre so your cameras show through.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAVED FIRESTORE BRAND KITS & STORE BUILDER */}
          {tab === 'kits' && (
            <div className="space-y-5">
              <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-[13.5px] font-medium text-[var(--ink)]">
                      1. Pick a style
                    </div>
                    <p className="text-[12px] text-[var(--ink-3)] mt-0.5">
                      Sets the tone of the colours, type and starter products.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-[8px] bg-[var(--surface)] border border-[var(--line)]">
                    {(['gaming', 'commerce', 'creator', 'podcast'] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setKitNiche(n)}
                        className={`h-7 px-2.5 rounded-[6px] text-[11px] font-medium capitalize whitespace-nowrap cursor-pointer ${
                          kitNiche === n
                            ? 'gather-btn-primary text-white'
                            : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--line)] space-y-2">
                  <label htmlFor="ai-kit-concept" className="block font-display text-[13.5px] font-medium text-[var(--ink)]">
                    2. Describe your brand
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] text-[var(--ink-3)] mr-0.5">Try:</span>
                    {KIT_EXAMPLES[kitNiche].map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setKitConcept(ex)}
                        className="h-7 px-2.5 rounded-full border border-[var(--line-2)] bg-[var(--surface)] hover:bg-[var(--fill-hover)] hover:border-[var(--accent-line)] text-[11.5px] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="ai-kit-concept"
                    type="text"
                    value={kitConcept}
                    onChange={(e) => setKitConcept(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && kitConcept.trim() && !kitLoading) {
                        e.preventDefault();
                        void handleGenerateBrandKit();
                      }
                    }}
                    placeholder="Who you are, the vibe, and what you sell"
                    className={`${inputCls} h-10 text-[13px] w-full sm:flex-1`}
                  />
                  <button
                    type="button"
                    disabled={kitLoading || !kitConcept.trim()}
                    onClick={() => void handleGenerateBrandKit()}
                    className={`${primaryBtnCls} h-10 px-4 text-[12.5px] justify-center`}
                  >
                    {kitLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{kitLoading ? 'Creating your kit…' : 'Create brand kit'}</span>
                  </button>
                </div>

                {kitError && (
                  <div className="p-3 rounded-[9px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[12px] text-[var(--danger)]">
                    {kitError}
                  </div>
                )}

                {draftKit && (
                  <div className="p-4 rounded-[12px] bg-[var(--surface)] border border-[var(--line)] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {draftKit.logoUrl && (
                          <img
                            src={draftKit.logoUrl}
                            alt={draftKit.storeName}
                            className="w-11 h-11 rounded-[9px] object-contain bg-[var(--bg)] border border-[var(--line)] p-1 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-[var(--ink)] truncate">
                            {draftKit.storeName} · {draftKit.name}
                          </div>
                          <div className="text-[11px] text-[var(--ink-3)] truncate">
                            {draftKit.storeTagline} · {draftKit.stageFont}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {onSaveBrandKit && (
                          <button
                            type="button"
                            disabled={savingKitId === draftKit.id}
                            onClick={async () => {
                              setSavingKitId(draftKit.id);
                              try {
                                await onSaveBrandKit(draftKit);
                              } finally {
                                setSavingKitId(null);
                              }
                            }}
                            className={secondaryBtnCls}
                          >
                            <FolderHeart className="w-3.5 h-3.5 text-[var(--cyan)]" />
                            <span>
                              {savingKitId === draftKit.id ? 'Saving…' : 'Save kit'}
                            </span>
                          </button>
                        )}
                        {onApplyBrandKit && (
                          <>
                            <button
                              type="button"
                              onClick={() => onApplyBrandKit(draftKit)}
                              className={secondaryBtnCls}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Apply Look</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onApplyBrandKit(draftKit, { openShop: true })}
                              className="h-8 px-3.5 rounded-[8px] gather-btn-tip text-[11.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Store className="w-3.5 h-3.5" />
                              <span>Launch Live Shop</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {draftKit.products.map((prod) => (
                        <div
                          key={prod.id}
                          className="p-2.5 rounded-[10px] bg-[var(--fill)] border border-[var(--line)] flex items-center gap-2.5 min-w-0"
                        >
                          <img
                            src={prod.imageUrl}
                            alt={prod.title}
                            className="w-12 h-12 rounded-[7px] object-contain bg-[var(--bg)] border border-[var(--line)] p-1 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-medium text-[var(--ink)] truncate">
                              {prod.title}
                            </div>
                            <div className="text-[11px] text-[var(--ink-3)] truncate">
                              {prod.category}
                            </div>
                            <div className="text-[11px] font-mono-num text-[var(--accent-text)]">
                              ${prod.price.toFixed(0)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-medium text-[var(--ink)]">
                    Your saved kits ({brandKits.length})
                  </div>
                  <span className="text-[11px] text-[var(--ink-3)]">
                    Available in every room you host
                  </span>
                </div>

                {brandKits.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {brandKits.map((kit) => (
                      <div
                        key={kit.id}
                        className="p-3.5 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {kit.logoUrl ? (
                              <img
                                src={kit.logoUrl}
                                alt={kit.name}
                                className="w-10 h-10 rounded-[8px] object-contain bg-[var(--bg)] border border-[var(--line)] p-1 shrink-0"
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-[8px] shrink-0 border border-[var(--line)]"
                                style={{ backgroundColor: kit.accentHex }}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">
                                {kit.name}
                              </div>
                              <div className="text-[11px] text-[var(--ink-3)] truncate">
                                {kit.storeName} · {kit.products.length} products
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className="w-3 h-3 rounded-full border border-white/20"
                              style={{ backgroundColor: kit.accentHex }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-white/20"
                              style={{ backgroundColor: kit.secondaryHex }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
                          {onDeleteBrandKit && (
                            <button
                              type="button"
                              onClick={() => void onDeleteBrandKit(kit.id)}
                              className="h-7 px-2 rounded-[7px] text-[11px] text-[var(--ink-3)] hover:text-[var(--danger)] hover:bg-[var(--surface)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                          {onApplyBrandKit && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <button
                                type="button"
                                onClick={() => onApplyBrandKit(kit)}
                                className={secondaryBtnCls}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Apply Look</span>
                              </button>
                              {kit.products.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => onApplyBrandKit(kit, { openShop: true })}
                                  className="h-8 px-3 rounded-[8px] gather-btn-tip text-[11.5px] font-medium inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                >
                                  <Store className="w-3.5 h-3.5" />
                                  <span>Launch Shop</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-7 px-4 rounded-[12px] bg-[var(--surface)]/50 border border-[var(--line)] text-center space-y-1.5">
                    <FolderHeart className="w-5 h-5 mx-auto text-[var(--accent-text)] opacity-85" />
                    <p className="text-[12.5px] font-medium text-[var(--ink)]">
                      No saved kits yet
                    </p>
                    <p className="text-[11px] text-[var(--ink-3)]">
                      Create a kit above and save it to reuse its logo, frames and products in any room.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GEMINI 3.8 VOICE STINGERS & AI SYNTH MUSIC LOOPS */}
          {tab === 'audio' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left column: voice intros */}
              <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-[13.5px] font-medium text-[var(--ink)] flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-[var(--accent-text)]" />
                      <span>Voice intro</span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                      Write a line or a two-host promo. It is voiced and added to your stinger deck.
                    </p>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={voiceScript}
                  onChange={(e) => setVoiceScript(e.target.value)}
                  placeholder="Write your intro drop or dialogue (Host: ... / CoHost: ...)"
                  className="w-full rounded-[9px] bg-[var(--surface)] border border-[var(--line-2)] px-3 py-2 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]"
                />

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10.5px] text-[var(--ink-3)] block">Lead Voice</span>
                    <select
                      value={voiceName}
                      onChange={(e) => setVoiceName(e.target.value as typeof voiceName)}
                      className={`${inputCls} w-full`}
                    >
                      {(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as const).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10.5px] text-[var(--ink-3)] block">Delivery Tone</span>
                    <input
                      type="text"
                      value={voiceMood}
                      onChange={(e) => setVoiceMood(e.target.value)}
                      className={`${inputCls} w-full`}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-[11.5px] text-[var(--ink-2)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dualSpeaker}
                      onChange={(e) => setDualSpeaker(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    <span>Dual-Speaker Hype Mode</span>
                  </label>

                  {dualSpeaker && (
                    <select
                      value={secondVoiceName}
                      onChange={(e) => setSecondVoiceName(e.target.value as typeof secondVoiceName)}
                      className="h-7 rounded-[7px] bg-[var(--surface)] border border-[var(--line-2)] px-2 text-[11px] text-[var(--ink)]"
                    >
                      {(['Puck', 'Kore', 'Charon', 'Fenrir', 'Zephyr'] as const).map((v) => (
                        <option key={v} value={v}>
                          Co-Host: {v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  type="button"
                  disabled={voiceLoading || !voiceScript.trim()}
                  onClick={() => void handleGenerateVoiceStinger()}
                  className={`${primaryBtnCls} w-full justify-center h-9`}
                >
                  {voiceLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  <span>{voiceLoading ? 'Synthesizing WAV…' : 'Generate Voice Stinger'}</span>
                </button>

                {voiceError && (
                  <div className="p-2.5 rounded-[8px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[11px] text-[var(--danger)]">
                    {voiceError}
                  </div>
                )}

                {voiceAudioUrl && (
                  <div className="p-3 rounded-[10px] bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                    <audio controls src={voiceAudioUrl} className="w-full h-8" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={voiceAudioUrl}
                        download="gather-voice-stinger.wav"
                        className={secondaryBtnCls}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download WAV</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleLoadVoiceToDeck()}
                        className="h-8 px-3 rounded-[8px] gather-btn-tip text-[11.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Add to Stinger Deck</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: AI Broadcast Synth Music Loops */}
              <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                <div>
                  <div className="font-display text-[13.5px] font-medium text-[var(--ink)] flex items-center gap-1.5">
                    <Music2 className="w-4 h-4 text-[var(--cyan)]" />
                    <span>AI Broadcast Music Bed</span>
                  </div>
                  <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                    Describe a mood and get a loopable track for intros, breaks and background.
                  </p>
                </div>

                <input
                  type="text"
                  value={musicPrompt}
                  onChange={(e) => setMusicPrompt(e.target.value)}
                  placeholder="Describe your intermission groove or esports walkout loop..."
                  className={`${inputCls} w-full`}
                />

                <div className="grid grid-cols-4 gap-1.5">
                  {(['lofi', 'esports', 'synthwave', 'keynote'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMusicMood(m)}
                      className={`h-7 rounded-[7px] text-[11px] font-medium capitalize cursor-pointer border ${
                        musicMood === m
                          ? 'gather-btn-primary text-white border-transparent'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink-2)]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--ink-3)]">Loop Length</span>
                  <div className="flex items-center gap-1.5">
                    {[8, 12, 16].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setMusicDuration(sec)}
                        className={`h-7 px-2.5 rounded-[7px] text-[11px] font-mono-num cursor-pointer border ${
                          musicDuration === sec
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-line)] text-[var(--accent-text)]'
                            : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink-2)]'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={musicLoading || !musicPrompt.trim()}
                  onClick={() => void handleGenerateMusicLoop()}
                  className={`${primaryBtnCls} w-full justify-center h-9`}
                >
                  {musicLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{musicLoading ? 'Composing WAV Loop…' : 'Compose Loopable Music Bed'}</span>
                </button>

                {musicError && (
                  <div className="p-2.5 rounded-[8px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[11px] text-[var(--danger)]">
                    {musicError}
                  </div>
                )}

                {musicAudioUrl && musicSpec && (
                  <div className="p-3 rounded-[10px] bg-[var(--surface)] border border-[var(--line)] space-y-2.5">
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="font-medium text-[var(--ink)]">{musicSpec.title}</span>
                      <span className="font-mono-num text-[var(--ink-3)]">
                        {musicSpec.bpm} BPM · {musicSpec.synthTimbre}
                      </span>
                    </div>
                    <audio controls loop src={musicAudioUrl} className="w-full h-8" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={musicAudioUrl}
                        download={`${musicSpec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`}
                        className={secondaryBtnCls}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download WAV</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleLoadMusicToDeck()}
                        className="h-8 px-3 rounded-[8px] gather-btn-tip text-[11.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Add Loop to Deck</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AI KINETIC MOTION BUMPERS */}
          {tab === 'bumper' && (
            <div className="space-y-4">
              <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-[13.5px] font-medium text-[var(--ink)]">
                      Choose a shape
                    </div>
                    <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                      Widescreen for the stage and YouTube, vertical for Shorts, Reels and TikTok.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['16:9', '9:16'] as const).map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setBumperAspect(ar)}
                        className={`h-7 px-2.5 rounded-[7px] text-[11px] font-mono-num cursor-pointer border ${
                          bumperAspect === ar
                            ? 'gather-btn-primary text-white border-transparent'
                            : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink-2)]'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'starting-soon', label: 'Starting Soon' },
                      { id: 'be-right-back', label: 'Be Right Back' },
                      { id: 'drop-alert', label: 'Shop Drop Alert' },
                      { id: 'stream-ending', label: 'Stream Ending' },
                    ] as const
                  ).map((bt) => (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() => setBumperType(bt.id)}
                      className={`h-7 px-2.5 rounded-[7px] text-[11px] font-medium cursor-pointer border ${
                        bumperType === bt.id
                          ? 'gather-btn-primary text-white border-transparent'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink-2)]'
                      }`}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={bumperPrompt}
                    onChange={(e) => setBumperPrompt(e.target.value)}
                    placeholder="Describe headline energy, pace, and visual style..."
                    className={`${inputCls} w-full sm:flex-1`}
                  />
                  <select
                    value={bumperDuration}
                    onChange={(e) => setBumperDuration(Number(e.target.value))}
                    className={inputCls}
                  >
                    <option value={4}>4s Loop</option>
                    <option value={5}>5s Loop</option>
                    <option value={6}>6s Loop</option>
                  </select>
                  <button
                    type="button"
                    disabled={bumperLoading || !bumperPrompt.trim()}
                    onClick={() => void handleGenerateMotionBumper()}
                    className={`${primaryBtnCls} h-9`}
                  >
                    {bumperLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Clapperboard className="w-3.5 h-3.5" />
                    )}
                    <span>{bumperLoading ? 'Rendering WebM…' : 'Render Motion Bumper'}</span>
                  </button>
                </div>
              </div>

              {bumperError && (
                <div className="p-3 rounded-[10px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[12px] text-[var(--danger)]">
                  {bumperError}
                </div>
              )}

              {bumperVideoUrl && bumperSpec ? (
                <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[12px] text-[var(--ink-2)]">
                      <span className="font-medium text-[var(--ink)]">{bumperSpec.title}</span> ·{' '}
                      <span className="font-mono-num">
                        {bumperSpec.aspectRatio} · {bumperSpec.durationSec}s WebM
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={bumperVideoUrl}
                        download={bumperFile?.name || 'gather-bumper.webm'}
                        className={secondaryBtnCls}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download WebM</span>
                      </a>
                      {bumperFile && (
                        <button
                          type="button"
                          onClick={() => {
                            onUploadMediaFile(bumperFile);
                            onToast('Loaded AI motion bumper onto Stage Media Deck.');
                            onClose();
                          }}
                          className="h-8 px-3.5 rounded-[8px] gather-btn-tip text-[11.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>Load onto Stage</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="rounded-[10px] overflow-hidden border border-[var(--line)] bg-black flex items-center justify-center max-h-72">
                    <video
                      src={bumperVideoUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="max-h-72 w-auto"
                    />
                  </div>
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[12px] bg-[var(--surface)]/50 border border-[var(--line)] text-center space-y-2">
                  <Clapperboard className="w-6 h-6 mx-auto text-[var(--accent-text)] opacity-85" />
                  <p className="font-display text-[13px] font-medium text-[var(--ink)]">
                    Real-time WebM broadcast bumpers
                  </p>
                  <p className="text-[11.5px] text-[var(--ink-3)] max-w-md mx-auto leading-relaxed">
                    Generate Starting Soon countdowns, BRB slates, or Flash Sale bumpers and play them directly inside StageCanvas.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI VIDEO & MAGIC CLIPS */}
          {tab === 'clips' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)]">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[13.5px] font-bold text-[var(--ink)]">
                    Find highlights
                  </div>
                  <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5 leading-relaxed">
                    Scan chat spikes and your rundown for share-worthy moments, or upload a video to play on stage.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadMediaFile(f);
                      e.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className={secondaryBtnCls}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Load Video</span>
                  </button>
                  <button
                    type="button"
                    disabled={clipsLoading}
                    onClick={() => void handleDetectMagicClips()}
                    className={primaryBtnCls}
                  >
                    {clipsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{clipsLoading ? 'Scanning…' : 'Find Magic Clips'}</span>
                  </button>
                </div>
              </div>

              {clipsError && (
                <div className="p-3 rounded-[10px] border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[12px] text-[var(--danger)]">
                  {clipsError}
                </div>
              )}

              {magicClips.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {magicClips.map((clip) => (
                    <div
                      key={clip.id}
                      className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-[var(--ink-3)] font-mono-num">
                          <span>
                            {formatSec(clip.startSec)} – {formatSec(clip.endSec)} · {clip.aspect}
                          </span>
                          <span>{clip.category}</span>
                        </div>
                        <h4 className="font-display text-[13.5px] font-semibold text-[var(--ink)]">
                          {clip.title}
                        </h4>
                        <p className="text-[12px] font-medium text-[var(--cyan)]">
                          “{clip.hookCaption}”
                        </p>
                        <p className="text-[11.5px] text-[var(--ink-3)]">{clip.viralityReason}</p>
                      </div>
                      <div className="flex items-center gap-2 pt-2.5 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() => {
                            onCreateClipMarker(clip.title, clip.startSec);
                            onExportReplayClip();
                          }}
                          className={primaryBtnCls}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save 30s Replay</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPushBanner(clip.title, clip.hookCaption)}
                          className={secondaryBtnCls}
                        >
                          <Tv className="w-3.5 h-3.5" />
                          <span>Headline on Stage</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 px-4 rounded-[12px] bg-[var(--surface)]/50 border border-[var(--line)] text-center space-y-2">
                  <Scissors className="w-6 h-6 mx-auto text-[var(--accent-text)] opacity-85" />
                  <p className="font-display text-[13px] font-semibold text-[var(--ink)]">
                    Extract Reels, Shorts &amp; TikTok highlights
                  </p>
                  <p className="text-[11.5px] text-[var(--ink-3)] max-w-md mx-auto leading-relaxed">
                    Click Find Magic Clips to turn your live chat spikes and rundown markers into ready-to-post replay clips.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PODCAST RSS & WAV HUB */}
          {tab === 'podcast' && (
            <div className="space-y-4">
              {/* Hosted RSS 2.0 Feed Bar */}
              <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-[13.5px] font-bold text-[var(--ink)]">
                      Your podcast feed
                    </div>
                    <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                      Add this link to Spotify, Apple Podcasts or Amazon Music once. New episodes appear there automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleLoadRssXml()}
                      className={secondaryBtnCls}
                    >
                      {showRssPreview ? 'Hide XML' : 'Inspect XML'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(rssUrl);
                        setCopiedRss(true);
                        onToast('Copied live Podcast RSS URL to clipboard.');
                        window.setTimeout(() => setCopiedRss(false), 1800);
                      }}
                      className={primaryBtnCls}
                    >
                      {copiedRss ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRss ? 'Copied URL' : 'Copy RSS URL'}</span>
                    </button>
                  </div>
                </div>

                <div className="px-3 py-2 rounded-[8px] bg-[var(--bg)]/65 border border-[var(--line)] font-mono-num text-[11.5px] text-[var(--ink-2)] select-all truncate">
                  {rssUrl}
                </div>

                {showRssPreview && rssXmlText && (
                  <pre className="max-h-40 overflow-auto p-3 rounded-[9px] bg-[var(--bg)] text-[var(--ink-2)] text-[11px] font-mono-num border border-[var(--line)] gather-scroll">
                    {rssXmlText}
                  </pre>
                )}
              </div>

              {/* 1-Click Podcast Platform Auto-Sync Connectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(podcastShow?.directories || []).map((dir) => {
                  const meta = DIRECTORY_LABELS[dir.platform];
                  return (
                    <div
                      key={dir.platform}
                      className="flex items-center justify-between gap-3 p-3 rounded-[11px] bg-[var(--fill)] border border-[var(--line)]"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[var(--ink)] truncate">
                          {meta.name}
                        </div>
                        <div className="text-[11px] text-[var(--ink-3)] truncate">
                          {dir.connected ? 'Auto-sync active on publish' : meta.subtitle}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleDirectory(dir.platform)}
                        className={`h-7 px-2.5 rounded-[7px] text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          dir.connected
                            ? 'bg-[var(--ok)]/16 text-[var(--ok)] border border-[var(--ok)]/35'
                            : 'bg-[var(--surface)] hover:bg-[var(--fill-hover)] border border-[var(--line-2)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {dir.connected ? 'Connected' : 'Connect'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Audio-Only Master Bus Recorder & Publisher */}
              <div className="p-4 rounded-[12px] bg-[var(--fill)] border border-[var(--line)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-[13.5px] font-bold text-[var(--ink)]">
                      Master Audio Bus Recorder (16-Bit PCM WAV)
                    </div>
                    <p className="text-[11.5px] text-[var(--ink-3)] mt-0.5">
                      Captures host + guest audio directly with zero video overhead.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      ref={audioUploadRef}
                      type="file"
                      accept="audio/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAudioFileUpload(f);
                        e.currentTarget.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => audioUploadRef.current?.click()}
                      className={secondaryBtnCls}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Audio</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSynthesizeTestWav}
                      className={secondaryBtnCls}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Sample WAV</span>
                    </button>
                    {isRecordingAudio ? (
                      <button
                        type="button"
                        onClick={stopAudioRecording}
                        className="h-8 px-3.5 rounded-[8px] gather-btn-live text-[11.5px] font-semibold font-mono-num inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Stop WAV ({formatSec(recordElapsedSec)})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startAudioRecording()}
                        className={primaryBtnCls}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Record Audio</span>
                      </button>
                    )}
                  </div>
                </div>

                {recordedWavUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[10px] bg-[var(--surface)] border border-[var(--line)]">
                    <audio controls src={recordedWavUrl} className="h-8 flex-1 min-w-[220px]" />
                    <button
                      type="button"
                      onClick={handleDownloadWav}
                      className={secondaryBtnCls}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export .WAV ({formatSec(recordedDurationSec)})</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={episodeTitle}
                    onChange={(e) => setEpisodeTitle(e.target.value)}
                    placeholder="Episode title..."
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={episodeSummary}
                    onChange={(e) => setEpisodeSummary(e.target.value)}
                    placeholder="Show notes & summary for Spotify / Apple..."
                    className={inputCls}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={publishingEpisode}
                    onClick={() => void handlePublishEpisodeToRss()}
                    className="h-8 px-3.5 rounded-[8px] gather-btn-tip text-[11.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
                  >
                    {publishingEpisode ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Rss className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {publishingEpisode
                        ? 'Publishing to RSS…'
                        : 'Publish Episode to Spotify & Apple RSS'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Published Episodes Feed */}
              <div className="space-y-2">
                <div className="text-[11.5px] font-semibold text-[var(--ink-2)] font-mono-num">
                  Published RSS Episodes ({podcastLoading ? '…' : podcastShow?.episodes.length || 0})
                </div>
                {(podcastShow?.episodes || []).map((ep) => (
                  <div
                    key={ep.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[10px] bg-[var(--fill)] border border-[var(--line)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-[var(--ink)] truncate">
                        {ep.title}
                      </div>
                      <div className="text-[11px] text-[var(--ink-3)] font-mono-num">
                        {formatSec(ep.durationSec)} · {(ep.fileSizeBytes / 1024).toFixed(0)} KB WAV ·{' '}
                        {new Date(ep.publishedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <audio controls src={ep.audioUrl} className="h-8 w-56 max-w-full" />
                    <a
                      href={ep.audioUrl}
                      download={`${ep.id}.wav`}
                      className={secondaryBtnCls}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>WAV</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
