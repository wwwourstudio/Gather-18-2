import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  Upload,
  X,
} from 'lucide-react';
import {
  CustomStageElement,
  MediaAsset,
  ProductItem,
  RoomState,
  VideoFxSettings,
} from '../types/studio';
import { renderFallbackStageFrame } from '../utils/stageRendererFallback';

interface StageCanvasProps {
  room: RoomState;
  localClientId: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  activeMedia: MediaAsset | null;
  videoFx: VideoFxSettings;
  editMode: boolean;
  viewerMode?: boolean;
  showSafeZone916?: boolean;
  onExitEditMode: () => void;
  onUpdateCustomElements: (els: CustomStageElement[]) => void;
  onResetCustomElements?: () => void;
  onDropMediaFile: (file: File) => void;
  onMediaPageChange: (delta: number) => void;
  onStopMedia: () => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const StageCanvas: React.FC<StageCanvasProps> = ({
  room,
  localClientId,
  localStream,
  screenStream,
  remoteStreams,
  activeMedia,
  videoFx,
  editMode,
  viewerMode = false,
  showSafeZone916 = false,
  onExitEditMode,
  onUpdateCustomElements,
  onResetCustomElements,
  onDropMediaFile,
  onMediaPageChange,
  onStopMedia,
  onCanvasReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [workerActive, setWorkerActive] = useState<boolean>(false);

  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const productImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const avatarImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const qrImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const logoImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const bgImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const overlayImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const transferredStaticKeysRef = useRef<Set<string>>(new Set());

  const [dragOver, setDragOver] = useState(false);
  const [vidPlaying, setVidPlaying] = useState(true);
  const [vidLoop, setVidLoop] = useState(false);
  const [vidProgress, setVidProgress] = useState(0);
  const [vidTimeStr, setVidTimeStr] = useState('00:00 / 00:00');
  const [dragTarget, setDragTarget] = useState<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    orig: CustomStageElement;
  } | null>(null);

  const isVertical = room.aspectRatio === '9:16';
  const stageW = isVertical ? 720 : 1280;
  const stageH = isVertical ? 1280 : 720;

  useEffect(() => {
    if (canvasRef.current) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  // Sync hidden video elements for local, remote, and screen streams
  useEffect(() => {
    const map = videoElementsRef.current;

    const ensureVideo = (id: string, stream: MediaStream | null) => {
      if (!stream || stream.getVideoTracks().length === 0) {
        map.delete(id);
        workerRef.current?.postMessage({ type: 'clearVideoFrame', id });
        return;
      }
      let vid = map.get(id);
      if (!vid) {
        vid = document.createElement('video');
        vid.autoplay = true;
        vid.muted = true;
        vid.playsInline = true;
        map.set(id, vid);
      }
      if (vid.srcObject !== stream) {
        vid.srcObject = stream;
        void vid.play().catch(() => {});
      }
    };

    ensureVideo(localClientId, localStream);
    for (const [peerId, stream] of Object.entries(remoteStreams)) {
      ensureVideo(peerId, stream);
    }

    if (screenStream && screenStream.getVideoTracks().length > 0) {
      if (!screenVideoRef.current) {
        screenVideoRef.current = document.createElement('video');
        screenVideoRef.current.autoplay = true;
        screenVideoRef.current.muted = true;
        screenVideoRef.current.playsInline = true;
      }
      if (screenVideoRef.current.srcObject !== screenStream) {
        screenVideoRef.current.srcObject = screenStream;
        void screenVideoRef.current.play().catch(() => {});
      }
    } else {
      screenVideoRef.current = null;
      workerRef.current?.postMessage({ type: 'clearVideoFrame', id: '__screen__' });
    }
  }, [localClientId, localStream, remoteStreams, screenStream]);

  // Generate QR code for Watch Page URL
  useEffect(() => {
    const watchUrl = `${window.location.origin}/?watch=${room.roomCode}`;
    if (qrImgRef.current?.url === watchUrl) return;
    void QRCode.toDataURL(watchUrl, {
      width: 140,
      margin: 1,
      color: { dark: '#080c16', light: '#ffffff' },
    }).then((dataUrl) => {
      const img = new Image();
      img.onload = () => {
        transferredStaticKeysRef.current.delete('qr');
      };
      img.src = dataUrl;
      qrImgRef.current = { url: watchUrl, img };
    });
  }, [room.roomCode]);

  // Sync video media playback timeline
  useEffect(() => {
    if (!activeMedia || activeMedia.kind !== 'video' || !activeMedia.videoEl) return;
    const vid = activeMedia.videoEl;
    const onTime = () => {
      if (!vid.duration) return;
      setVidProgress(vid.currentTime / vid.duration);
      const fmt = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      setVidTimeStr(`${fmt(vid.currentTime)} / ${fmt(vid.duration)}`);
    };
    vid.addEventListener('timeupdate', onTime);
    return () => vid.removeEventListener('timeupdate', onTime);
  }, [activeMedia]);

  // Initialize 60fps OffscreenCanvas Web Worker compositor
  useEffect(() => {
    const supportsOffscreen =
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap === 'function';

    if (!supportsOffscreen) {
      setWorkerActive(false);
      return;
    }

    try {
      const worker = new Worker(
        new URL('../workers/stageCompositor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;
      setWorkerActive(true);

      worker.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as { type?: string; bitmap?: ImageBitmap; width?: number; height?: number };
        if (msg.type === 'frame' && msg.bitmap) {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(msg.bitmap, 0, 0, canvas.width, canvas.height);
            }
          }
          msg.bitmap.close();
        }
      };

      worker.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        setWorkerActive(false);
      };

      return () => {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
        workerRef.current = null;
        transferredStaticKeysRef.current.clear();
      };
    } catch {
      setWorkerActive(false);
    }
  }, []);

  // Push lightweight Room + FX state snapshot to OffscreenCanvas Worker
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !workerActive) return;

    worker.postMessage({
      type: 'state',
      stageW,
      stageH,
      localClientId,
      viewerMode,
      hasMedia: Boolean(screenVideoRef.current || activeMedia),
      videoFx,
      room: {
        roomCode: room.roomCode,
        title: room.title,
        aspectRatio: room.aspectRatio,
        watchMode: room.watchMode,
        participants: room.participants.map((p) => ({
          id: p.id,
          name: p.name,
          initials: p.initials,
          avatarUrl: p.avatarUrl,
          onStage: p.onStage,
          micOn: p.micOn,
          camOn: p.camOn,
        })),
        scene: room.scene,
        overlays: room.overlays,
        brand: room.brand,
        commerce: {
          storeLabel: room.commerce.storeLabel,
          pinnedProductId: room.commerce.pinnedProductId,
          products: room.commerce.products.map((p) => ({
            id: p.id,
            source: p.source,
            title: p.title,
            price: p.price,
            stock: p.stock,
            imageUrl: p.imageUrl,
          })),
          activeFlashSale: room.commerce.activeFlashSale || null,
          latestSalePopup: room.commerce.latestSalePopup || null,
        },
        gamer: {
          gameTitle: room.gamer.gameTitle,
          activePoll: room.gamer.activePoll,
        },
        hypeTrain: room.hypeTrain,
        questions: room.questions,
        chatMessages: room.chatMessages.slice(-20),
      },
    });
  }, [room, localClientId, videoFx, stageW, stageH, viewerMode, activeMedia, workerActive]);

  // Helper for loading & transferring static CORS images to Worker
  useEffect(() => {
    if (!workerActive || !workerRef.current) return;
    const worker = workerRef.current;

    const transferStatic = (key: string, img: HTMLImageElement | null) => {
      if (!img || !img.complete || img.naturalWidth === 0 || transferredStaticKeysRef.current.has(key)) {
        return;
      }
      transferredStaticKeysRef.current.add(key);
      void createImageBitmap(img)
        .then((bitmap) => {
          worker.postMessage({ type: 'staticAsset', key, bitmap }, [bitmap]);
        })
        .catch(() => {
          transferredStaticKeysRef.current.delete(key);
        });
    };

    const ensureStaticUrl = (key: string, url: string, ref: React.MutableRefObject<{ url: string; img: HTMLImageElement } | null>) => {
      if (ref.current?.url !== url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => transferStatic(key, img);
        img.src = url;
        ref.current = { url, img };
      } else {
        transferStatic(key, ref.current.img);
      }
    };

    if (qrImgRef.current?.img) transferStatic('qr', qrImgRef.current.img);
    if (room.brand.customBackdropUrl) {
      ensureStaticUrl(`bg:${room.brand.customBackdropUrl}`, room.brand.customBackdropUrl, bgImgRef);
    }
    if (room.brand.customOverlayUrl) {
      ensureStaticUrl(`overlay:${room.brand.customOverlayUrl}`, room.brand.customOverlayUrl, overlayImgRef);
    }
    if (room.brand.logoUrl) {
      ensureStaticUrl(`logo:${room.brand.logoUrl}`, room.brand.logoUrl, logoImgRef);
    }

    for (const p of room.participants) {
      if (!p.avatarUrl) continue;
      const key = `avatar:${p.avatarUrl}`;
      let img = avatarImgCacheRef.current.get(p.avatarUrl);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        const captured = img;
        img.onload = () => transferStatic(key, captured);
        img.src = p.avatarUrl;
        avatarImgCacheRef.current.set(p.avatarUrl, img);
      } else {
        transferStatic(key, img);
      }
    }

    for (const prod of room.commerce.products) {
      if (!prod.imageUrl) continue;
      const key = `product:${prod.imageUrl}`;
      let img = productImgCacheRef.current.get(prod.imageUrl);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        const captured = img;
        img.onload = () => transferStatic(key, captured);
        img.src = prod.imageUrl;
        productImgCacheRef.current.set(prod.imageUrl, img);
      } else {
        transferStatic(key, img);
      }
    }
  }, [room.participants, room.commerce.products, room.brand, workerActive]);

  // Pump live video + media ImageBitmaps to Worker (with async backpressure guard) OR run main-thread fallback
  useEffect(() => {
    let rafId = 0;
    const startTs = performance.now();

    if (workerActive && workerRef.current) {
      const worker = workerRef.current;
      let busy = false;

      const pumpFrames = async () => {
        if (busy) {
          rafId = requestAnimationFrame(() => void pumpFrames());
          return;
        }
        busy = true;
        try {
          for (const [id, vid] of videoElementsRef.current.entries()) {
            if (vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
              const bitmap = await createImageBitmap(vid);
              worker.postMessage({ type: 'videoFrame', id, bitmap }, [bitmap]);
            }
          }
          const sv = screenVideoRef.current;
          if (sv && sv.readyState >= 2 && sv.videoWidth > 0 && sv.videoHeight > 0) {
            const bitmap = await createImageBitmap(sv);
            worker.postMessage({ type: 'videoFrame', id: '__screen__', bitmap }, [bitmap]);
          }
          if (activeMedia) {
            if (activeMedia.kind === 'pdf' && activeMedia.pages?.length) {
              const pg = activeMedia.pages[activeMedia.currentPage - 1];
              if (pg && pg.width > 0) {
                const bitmap = await createImageBitmap(pg);
                worker.postMessage({ type: 'mediaFrame', bitmap }, [bitmap]);
              }
            } else if (
              activeMedia.kind === 'video' &&
              activeMedia.videoEl &&
              activeMedia.videoEl.readyState >= 2 &&
              activeMedia.videoEl.videoWidth > 0
            ) {
              const bitmap = await createImageBitmap(activeMedia.videoEl);
              worker.postMessage({ type: 'mediaFrame', bitmap }, [bitmap]);
            } else if (
              activeMedia.kind === 'image' &&
              activeMedia.imageEl?.complete &&
              activeMedia.imageEl.naturalWidth > 0
            ) {
              const bitmap = await createImageBitmap(activeMedia.imageEl);
              worker.postMessage({ type: 'mediaFrame', bitmap }, [bitmap]);
            }
          } else {
            worker.postMessage({ type: 'mediaFrame', bitmap: null });
          }
        } catch {
          // ignore transient bitmap errors when stream is ending
        } finally {
          busy = false;
        }
        rafId = requestAnimationFrame(() => void pumpFrames());
      };

      rafId = requestAnimationFrame(() => void pumpFrames());
      return () => cancelAnimationFrame(rafId);
    }

    // Main-thread fallback loop if OffscreenCanvas Worker is unavailable
    const getProductImg = (prod: ProductItem): HTMLImageElement | null => {
      const cached = productImgCacheRef.current.get(prod.imageUrl);
      if (cached) return cached;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = prod.imageUrl;
      productImgCacheRef.current.set(prod.imageUrl, img);
      return img;
    };

    const getAvatarImg = (url: string): HTMLImageElement | null => {
      const cached = avatarImgCacheRef.current.get(url);
      if (cached) return cached;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      avatarImgCacheRef.current.set(url, img);
      return img;
    };

    const tick = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        renderFallbackStageFrame({
          ctx,
          now,
          startTs,
          stageW,
          stageH,
          isVertical,
          room,
          localClientId,
          videoFx,
          viewerMode,
          activeMedia,
          videoElements: videoElementsRef.current,
          screenVideo: screenVideoRef.current,
          getProductImg,
          getAvatarImg,
          qrImg: qrImgRef.current?.img || null,
          logoImg: logoImgRef.current?.img || null,
          bgImg: bgImgRef.current?.img || null,
          overlayImg: overlayImgRef.current?.img || null,
        });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [workerActive, room, localClientId, activeMedia, videoFx, stageW, stageH, isVertical, viewerMode]);

  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragTarget || !editMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - dragTarget.startX) / rect.width;
    const dy = (e.clientY - dragTarget.startY) / rect.height;

    const updated = room.scene.customElements.map((el) => {
      if (el.id !== dragTarget.id) return el;
      if (dragTarget.mode === 'move') {
        return {
          ...el,
          x: Math.max(0.02, Math.min(0.98 - el.w, dragTarget.orig.x + dx)),
          y: Math.max(0.02, Math.min(0.98 - el.h, dragTarget.orig.y + dy)),
        };
      }
      return {
        ...el,
        w: Math.max(0.15, Math.min(0.98 - el.x, dragTarget.orig.w + dx)),
        h: Math.max(0.15, Math.min(0.98 - el.y, dragTarget.orig.h + dy)),
      };
    });
    onUpdateCustomElements(updated);
  };

  return (
    <div className="gather-stage-wrap">
      <div
        onDragOver={
          viewerMode
            ? undefined
            : (e) => {
                e.preventDefault();
                setDragOver(true);
              }
        }
        onDragLeave={viewerMode ? undefined : () => setDragOver(false)}
        onDrop={
          viewerMode
            ? undefined
            : (e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) onDropMediaFile(file);
              }
        }
        className={isVertical ? 'gather-stage-frame-vertical' : 'gather-stage-frame'}
      >
        <canvas
          ref={canvasRef}
          width={stageW}
          height={stageH}
          aria-label="Broadcast stage program output"
          className="w-full h-full block object-contain"
        />

        {!viewerMode && !isVertical && showSafeZone916 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[31.64%] border-x-2 border-dashed border-sky-400/65 bg-sky-400/[0.03] flex items-end justify-center pb-2"
          >
            <span className="px-2 py-0.5 rounded bg-[var(--surface-solid)] text-[10px] font-mono-num text-[var(--accent-text)] border border-[var(--line-2)]">
              9:16 Shorts / Reels Safe Frame
            </span>
          </div>
        )}

        {!viewerMode && dragOver && (
          <div className="absolute inset-0 bg-[var(--accent)]/25 backdrop-blur-sm border-2 border-dashed border-[var(--accent)] flex flex-col items-center justify-center gap-2 pointer-events-none">
            <Upload className="w-8 h-8 text-white" />
            <p className="text-sm font-semibold text-white">Drop PDF, Video, or Image to present</p>
          </div>
        )}

        {!viewerMode && editMode && (
          <div
            onPointerMove={handleOverlayPointerMove}
            onPointerUp={() => setDragTarget(null)}
            className="absolute inset-0 bg-black/25 select-none"
          >
            <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 bg-[var(--surface)]/95 backdrop-blur-md border border-[var(--line-2)] px-3 py-1.5 rounded-[8px] text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--ink-2)] mr-1">
                  Stage Designer
                </span>
                {(
                  [
                    { kind: 'text', label: '+ Text', text: 'Live Broadcast' },
                    { kind: 'clock', label: '+ Clock' },
                    { kind: 'block', label: '+ Block' },
                    { kind: 'qr', label: '+ Watch QR' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => {
                      const nextEl: CustomStageElement = {
                        id: `el-${item.kind}-${Date.now().toString(36)}`,
                        kind: item.kind,
                        label: item.label.replace('+ ', ''),
                        text: 'text' in item ? item.text : undefined,
                        x: 0.08,
                        y: 0.08,
                        w: item.kind === 'qr' ? 0.16 : 0.28,
                        h: item.kind === 'qr' ? 0.24 : 0.14,
                      };
                      onUpdateCustomElements([...room.scene.customElements, nextEl]);
                    }}
                    className="h-6 px-2 rounded-[5px] bg-[var(--bg)] hover:border-[var(--accent)] border border-[var(--line-2)] text-[11px] font-medium text-[var(--ink)] cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                {onResetCustomElements && (
                  <button
                    type="button"
                    onClick={onResetCustomElements}
                    className="h-6 px-2 rounded-[5px] text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onExitEditMode}
                className="h-6 px-2.5 rounded-[5px] bg-[var(--accent)] text-white text-[11px] font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
            {room.scene.customElements.map((el) => (
              <div
                key={el.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({
                    id: el.id,
                    mode: 'move',
                    startX: e.clientX,
                    startY: e.clientY,
                    orig: el,
                  });
                }}
                style={{
                  left: `${el.x * 100}%`,
                  top: `${el.y * 100}%`,
                  width: `${el.w * 100}%`,
                  height: `${el.h * 100}%`,
                }}
                className="absolute border-2 border-[var(--accent)] bg-[var(--accent)]/15 rounded-lg cursor-move flex items-start justify-between p-2"
              >
                <span className="text-[11px] font-mono-num bg-black/75 text-white px-2 py-0.5 rounded truncate">
                  {el.label}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${el.label}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateCustomElements(
                      room.scene.customElements.filter((item) => item.id !== el.id)
                    );
                  }}
                  className="w-5 h-5 rounded bg-black/75 text-white/80 hover:text-[var(--danger)] grid place-items-center cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDragTarget({
                      id: el.id,
                      mode: 'resize',
                      startX: e.clientX,
                      startY: e.clientY,
                      orig: el,
                    });
                  }}
                  className="absolute bottom-1 right-1 w-4 h-4 rounded bg-white border border-[var(--accent)] cursor-nwse-resize"
                />
              </div>
            ))}
          </div>
        )}

        {activeMedia && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-white text-xs">
            <span className="font-mono-num text-[var(--accent-text)] uppercase">
              {activeMedia.kind}
            </span>
            <span className="max-w-[140px] truncate text-white/85">{activeMedia.name}</span>

            {activeMedia.kind === 'pdf' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onMediaPageChange(-1)}
                  aria-label="Previous slide"
                  className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono-num px-1">
                  {activeMedia.currentPage} / {activeMedia.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => onMediaPageChange(1)}
                  aria-label="Next slide"
                  className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeMedia.kind === 'video' && activeMedia.videoEl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const v = activeMedia.videoEl!;
                    if (v.paused) {
                      void v.play();
                      setVidPlaying(true);
                    } else {
                      v.pause();
                      setVidPlaying(false);
                    }
                  }}
                  className="h-7 px-2 rounded bg-white/10 hover:bg-white/20 inline-flex items-center gap-1 cursor-pointer"
                >
                  {vidPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={vidProgress}
                  onChange={(e) => {
                    const v = activeMedia.videoEl!;
                    if (v.duration) v.currentTime = Number(e.target.value) * v.duration;
                  }}
                  className="gather-range w-20"
                />
                <span className="font-mono-num text-[11px]">{vidTimeStr}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !vidLoop;
                    activeMedia.videoEl!.loop = next;
                    setVidLoop(next);
                  }}
                  aria-label="Toggle loop"
                  className={`h-7 w-7 grid place-items-center rounded cursor-pointer ${
                    vidLoop ? 'bg-[var(--accent)]' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onStopMedia}
              aria-label="Stop presenting"
              className="h-7 w-7 grid place-items-center rounded bg-white/10 hover:bg-[var(--live)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
