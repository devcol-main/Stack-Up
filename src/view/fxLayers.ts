// 별 배경 / VFX 레이어. 프레임 중 할당 없음, shadowBlur 없음 (알파 도형만).
import type { FrameContext, RenderLayer } from './layers';
import { RenderPhase } from './layers';
import { levelToY, worldToScreenW, worldToScreenX } from './layout';
import { BLOCK_STYLES } from './palette';
import { easeOutCubic } from './effects';
import { StarField } from './stars';
import { VIEW_CONFIG } from './viewConfig';

/** 그라디언트 바로 위, 그리드 아래. */
export const STARS_PHASE = RenderPhase.Background + 10;

export class StarsLayer implements RenderLayer {
  readonly phase = STARS_PHASE;
  readonly field: StarField;

  constructor(rand: () => number) {
    this.field = new StarField(rand);
  }

  update(dt: number, f: FrameContext): void {
    this.field.update(dt, f.reducedMotion ? VIEW_CONFIG.starFlowReduced : 1);
  }

  draw({ ctx, layout, cam }: FrameContext): void {
    const fld = this.field;
    const cfgs = VIEW_CONFIG.stars;
    for (let l = 0; l < fld.layerCount; l++) {
      const cfg = cfgs[l]!;
      ctx.globalAlpha = cfg.alpha;
      ctx.fillStyle = cfg.color;
      const end = fld.starts[l + 1]!;
      for (let i = fld.starts[l]!; i < end; i++) {
        ctx.fillRect(fld.u[i]! * layout.cssW, fld.screenY(i, l, cam, layout.blockH, layout.cssH), cfg.size, cfg.size);
      }
    }
    ctx.globalAlpha = 1;
  }
}

export class EffectsLayer implements RenderLayer {
  readonly phase = RenderPhase.Effects;

  draw({ ctx, layout, cam, effects }: FrameContext): void {
    const c = VIEW_CONFIG;
    const bh = layout.blockH;

    // 외곽선 플래시 / 폭 회복
    const flashes = effects.flashes;
    for (let i = 0; i < flashes.length; i++) {
      const f = flashes[i]!;
      if (!f.active) continue;
      const p = f.t / f.dur;
      const e = easeOutCubic(p);
      const inset = bh * VIEW_CONFIG.blockInset;
      const y = levelToY(layout, f.level, cam) + inset;
      const h = bh - inset * 2;
      ctx.globalAlpha = 1 - p;
      ctx.lineWidth = c.flashLineWidth;
      if (f.grow > 0) {
        // 이전 폭에서 새 폭으로 늘어나는 흰 외곽선
        const wNow = f.w - f.grow * (1 - e);
        const cx = worldToScreenX(layout, f.x + f.w / 2);
        const sw = worldToScreenW(layout, wNow);
        ctx.strokeStyle = '#FFFFFF';
        ctx.strokeRect(cx - sw / 2, y, sw, h);
      } else {
        const spread = e * bh * c.flashSpread;
        ctx.strokeStyle = BLOCK_STYLES[f.colorIndex % BLOCK_STYLES.length]!.stroke;
        ctx.strokeRect(
          worldToScreenX(layout, f.x) - spread, y - spread, worldToScreenW(layout, f.w) + spread * 2, h + spread * 2,
        );
      }
    }

    // 링 파동 (바닥 면에 퍼지는 것처럼 세로로 눌린 타원)
    const rings = effects.rings;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i]!;
      if (!r.active) continue;
      const p = r.t / r.dur;
      const rx = layout.playW * c.ringRadius * r.scale * easeOutCubic(p);
      if (rx < 0.5) continue;
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.lineWidth = c.ringLineWidth * (1 - p * 0.6);
      ctx.strokeStyle = BLOCK_STYLES[r.colorIndex % BLOCK_STYLES.length]!.stroke;
      ctx.beginPath();
      ctx.ellipse(worldToScreenX(layout, r.x), levelToY(layout, r.y, cam), rx, rx * c.ringSquash, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 입자
    const ps = effects.particles;
    const size = c.particleSize;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]!;
      if (!p.active) continue;
      ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
      ctx.fillStyle = BLOCK_STYLES[p.colorIndex % BLOCK_STYLES.length]!.stroke;
      ctx.fillRect(worldToScreenX(layout, p.x) - size / 2, levelToY(layout, p.y, cam) - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }
}
