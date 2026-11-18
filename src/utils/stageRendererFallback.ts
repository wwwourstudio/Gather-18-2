import { BACKDROP_PRESETS } from '../constants/studioDefaults';
import {
  MediaAsset,
  Participant,
  ProductItem,
  RoomState,
  VideoFxSettings,
} from '../types/studio';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  mirror = false
) {
  if (!sw || !sh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const cw = dw / scale;
  const ch = dh / scale;
  const sx = (sw - cw) / 2;
  const sy = (sh - ch) / 2;

  ctx.save();
  if (mirror) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, cw, ch, 0, 0, dw, dh);
  } else {
    ctx.drawImage(source, sx, sy, cw, ch, dx, dy, dw, dh);
  }
  ctx.restore();
}

export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  if (!sw || !sh) return;
  const scale = Math.min(dw / sw, dh / sh);
  const rw = sw * scale;
  const rh = sh * scale;
  const rx = dx + (dw - rw) / 2;
  const ry = dy + (dh - rh) / 2;
  ctx.drawImage(source, 0, 0, sw, sh, rx, ry, rw, rh);
}

export interface FallbackRenderContext {
  ctx: CanvasRenderingContext2D;
  now: number;
  startTs: number;
  stageW: number;
  stageH: number;
  isVertical: boolean;
  room: RoomState;
  localClientId: string;
  videoFx: VideoFxSettings;
  viewerMode: boolean;
  activeMedia: MediaAsset | null;
  videoElements: Map<string, HTMLVideoElement>;
  screenVideo: HTMLVideoElement | null;
  getProductImg: (prod: ProductItem) => HTMLImageElement | null;
  getAvatarImg: (url: string) => HTMLImageElement | null;
  qrImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
  bgImg: HTMLImageElement | null;
  overlayImg: HTMLImageElement | null;
}

export function renderFallbackStageFrame(rc: FallbackRenderContext) {
  const {
    ctx,
    now,
    startTs,
    stageW: w,
    stageH: h,
    isVertical,
    room,
    localClientId,
    videoFx,
    viewerMode,
    activeMedia,
    videoElements,
    screenVideo,
    getProductImg,
    getAvatarImg,
    qrImg,
    logoImg,
    bgImg,
    overlayImg,
  } = rc;

  const preset = BACKDROP_PRESETS[room.brand.backdrop] || BACKDROP_PRESETS.dusk;
  const accent = room.brand.accent || '#2f6bf0';

  const drawTile = (p: Participant, rect: Rect) => {
    const pad = 6;
    const rx = rect.x + pad;
    const ry = rect.y + pad;
    const rw = Math.max(40, rect.w - pad * 2);
    const rh = Math.max(40, rect.h - pad * 2);

    ctx.save();
    drawRoundedRect(ctx, rx, ry, rw, rh, 14);
    ctx.clip();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rx, ry, rw, rh);

    const vid = videoElements.get(p.id);
    const hasLive =
      p.camOn && vid && vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0;
    if (hasLive && vid) {
      if (p.id === localClientId) {
        ctx.filter = `brightness(${videoFx.brightness}%) contrast(${videoFx.contrast}%) saturate(${videoFx.saturation}%)`;
      }
      drawImageCover(
        ctx,
        vid,
        vid.videoWidth,
        vid.videoHeight,
        rx,
        ry,
        rw,
        rh,
        p.id === localClientId && videoFx.mirror
      );
      ctx.filter = 'none';
    } else if (p.avatarUrl) {
      const av = getAvatarImg(p.avatarUrl);
      if (av && av.complete && av.naturalWidth > 0) {
        drawImageCover(ctx, av, av.naturalWidth, av.naturalHeight, rx, ry, rw, rh, false);
      }
    } else {
      const cx = rx + rw / 2;
      const cy = ry + rh / 2 - 6;
      const radius = Math.min(rw, rh) * 0.145;
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 2.6);
      halo.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
      halo.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(rx, ry, rw, rh);

      ctx.beginPath();
      ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const badgeGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      badgeGrad.addColorStop(0, '#18274b');
      badgeGrad.addColorStop(1, '#0b1224');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = badgeGrad;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = `500 ${Math.max(16, Math.round(radius * 0.66))}px "Outfit", "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.initials, cx, cy + 1);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
      ctx.font = '400 11px "Outfit", "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Camera off', cx, cy + radius + 20);
    }

    if (room.brand.showNames) {
      const labelText = `${p.name}${!p.micOn ? ' · Muted' : ''}`;
      ctx.font = '500 13px "Outfit", "Plus Jakarta Sans", sans-serif';
      const bw = Math.min(rw - 24, ctx.measureText(labelText).width + 24);
      const bx = rx + 12;
      const by = ry + rh - (viewerMode ? 58 : 40);
      ctx.fillStyle = 'rgba(10, 17, 35, 0.76)';
      drawRoundedRect(ctx, bx, by, bw, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, bx + 11, by + 14.5, bw - 20);
    }
    ctx.restore();
  };

  const drawMedia = (rect: Rect) => {
    const rx = rect.x + 6;
    const ry = rect.y + 6;
    const rw = Math.max(60, rect.w - 12);
    const rh = Math.max(60, rect.h - 12);
    ctx.save();
    drawRoundedRect(ctx, rx, ry, rw, rh, 14);
    ctx.clip();
    ctx.fillStyle = '#070b14';
    ctx.fillRect(rx, ry, rw, rh);
    if (screenVideo && screenVideo.readyState >= 2) {
      drawImageContain(ctx, screenVideo, screenVideo.videoWidth, screenVideo.videoHeight, rx, ry, rw, rh);
    } else if (activeMedia?.kind === 'pdf' && activeMedia.pages?.length) {
      const pg = activeMedia.pages[activeMedia.currentPage - 1];
      if (pg) drawImageContain(ctx, pg, pg.width, pg.height, rx, ry, rw, rh);
    } else if (activeMedia?.kind === 'video' && activeMedia.videoEl && activeMedia.videoEl.readyState >= 2) {
      drawImageContain(
        ctx,
        activeMedia.videoEl,
        activeMedia.videoEl.videoWidth,
        activeMedia.videoEl.videoHeight,
        rx,
        ry,
        rw,
        rh
      );
    } else if (activeMedia?.kind === 'image' && activeMedia.imageEl?.complete) {
      drawImageContain(
        ctx,
        activeMedia.imageEl,
        activeMedia.imageEl.naturalWidth,
        activeMedia.imageEl.naturalHeight,
        rx,
        ry,
        rw,
        rh
      );
    }
    ctx.restore();
  };

  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, preset.gradient[0]);
  bgGrad.addColorStop(1, preset.gradient[1]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    drawImageCover(ctx, bgImg, bgImg.naturalWidth, bgImg.naturalHeight, 0, 0, w, h);
    ctx.fillStyle = `rgba(8, 12, 22, ${room.brand.backdropDim / 100})`;
    ctx.fillRect(0, 0, w, h);
  }

  const onStage = room.participants.filter((p) => p.onStage).slice(0, 6);
  const pad = 26;
  const area: Rect = { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };
  const tpl = room.scene.templateId;
  const hasMedia = Boolean(screenVideo || activeMedia);

  if ((tpl === 'full-media' || (hasMedia && tpl === 'solo')) && !isVertical) {
    drawMedia(area);
  } else if (tpl === 'screen-cam' || tpl === 'slides-cam') {
    const mediaW = area.w * 0.72;
    drawMedia({ x: area.x, y: area.y, w: mediaW, h: area.h });
    const sideW = area.w - mediaW;
    const count = Math.max(1, Math.min(3, onStage.length));
    const tileH = area.h / count;
    onStage.slice(0, count).forEach((p, idx) =>
      drawTile(p, { x: area.x + mediaW, y: area.y + idx * tileH, w: sideW, h: tileH })
    );
  } else {
    const cols = onStage.length <= 1 ? 1 : onStage.length <= 4 ? 2 : 3;
    const rows = Math.max(1, Math.ceil(onStage.length / cols));
    const cw = area.w / cols;
    const ch = area.h / rows;
    onStage.forEach((p, idx) =>
      drawTile(p, {
        x: area.x + (idx % cols) * cw,
        y: area.y + Math.floor(idx / cols) * ch,
        w: cw,
        h: ch,
      })
    );
  }

  if (overlayImg && overlayImg.complete && overlayImg.naturalWidth > 0) {
    ctx.drawImage(overlayImg, 0, 0, w, h);
  }
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const ls = room.brand.logoSize || 44;
    ctx.drawImage(logoImg, w - ls - 26, 26, ls, ls);
  }
  if (room.overlays.banner.visible && room.overlays.banner.title) {
    const bx = 34;
    const by = h - 98;
    const bw = Math.min(w - 68, 640);
    ctx.fillStyle = 'rgba(13, 22, 44, 0.85)';
    drawRoundedRect(ctx, bx, by, bw, 64, 11);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 20px "${room.brand.font}", sans-serif`;
    ctx.fillText(room.overlays.banner.title, bx + 18, by + 28, bw - 36);
  }

  void getProductImg;
  void qrImg;
  void now;
  void startTs;
}
