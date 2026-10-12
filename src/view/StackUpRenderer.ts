import type { StackUpEvent, StackUpLogic } from '../core/StackUpLogic';
import { GlowSprites } from './glowSprites';
import { BackgroundLayer, BlocksLayer, GridLayer, PiecesLayer, type FrameContext, type RenderLayer } from './layers';
import { cameraTarget, computeLayout, stepCamera } from './layout';
import { PiecePool } from './pieces';
import { VIEW_CONFIG } from './viewConfig';

export interface RendererOptions {
  /** 조각 회전 방향/속도 난수. 기본 Math.random. */
  random?: () => number;
}

/**
 * Canvas 2D 렌더러. 게임 상태는 읽기만 한다.
 * 사용: 매 프레임 logic.consumeEvents(renderer.onEvent) → renderer.update(dt) → renderer.render().
 * 확장: addLayer()로 RenderPhase 기준 위치에 레이어(별 배경, VFX, HUD)를 끼운다.
 */
export class StackUpRenderer {
  readonly frame: FrameContext;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites = new GlowSprites();
  private readonly pieces = new PiecePool();
  private readonly layers: RenderLayer[] = [];
  private readonly random: () => number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly logic: StackUpLogic,
    options: RendererOptions = {},
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.random = options.random ?? Math.random;
    this.frame = {
      ctx,
      layout: computeLayout(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio),
      logic,
      sprites: this.sprites,
      pieces: this.pieces,
      cam: 0,
      time: 0,
    };
    this.addLayer(new BackgroundLayer());
    this.addLayer(new GridLayer());
    this.addLayer(new BlocksLayer());
    this.addLayer(new PiecesLayer());
    this.resize();
  }

  /** phase 순으로 정렬해 삽입 (같은 phase면 먼저 추가한 것이 먼저). 프레임 중 정렬 없음. */
  addLayer(layer: RenderLayer): void {
    let i = this.layers.length;
    while (i > 0 && this.layers[i - 1]!.phase > layer.phase) i--;
    this.layers.splice(i, 0, layer);
    layer.onResize?.(this.frame.layout);
  }

  /** 캔버스 크기, dpr, 레이아웃, 글로우 스프라이트를 다시 맞춘다. */
  resize(): void {
    const c = this.canvas;
    const layout = computeLayout(c.clientWidth, c.clientHeight, window.devicePixelRatio);
    this.frame.layout = layout;
    const w = Math.round(layout.cssW * layout.dpr);
    const h = Math.round(layout.cssH * layout.dpr);
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    this.sprites.build(layout.blockH, layout.dpr);
    for (const l of this.layers) l.onResize?.(layout);
  }

  /** 새 게임: 카메라를 맨 아래로 되돌리고 조각을 치운다. */
  reset(): void {
    this.frame.cam = 0;
    this.pieces.clear();
  }

  /** core 이벤트 처리. 인자 캡처가 없으므로 그대로 consumeEvents에 넘겨도 된다. */
  readonly onEvent = (e: StackUpEvent): void => {
    if (e.type === 'cut') {
      const dir = e.side === 'left' ? -1 : 1;
      const vr = dir * (VIEW_CONFIG.pieceSpinMin + this.random() * VIEW_CONFIG.pieceSpinRange);
      this.pieces.spawn(e.x, e.w, e.level, e.colorIndex, vr);
    } else if (e.type === 'gameOver') {
      const vr = (this.random() - 0.5) * VIEW_CONFIG.dropSpin;
      this.pieces.spawn(e.x, e.w, e.level, e.colorIndex, vr);
    }
  };

  update(dt: number): void {
    const f = this.frame;
    f.time += dt;
    f.cam = stepCamera(f.cam, cameraTarget(this.logic.floors, f.layout.followLevels), dt);
    this.pieces.update(dt, f.layout, f.cam);
    for (let i = 0; i < this.layers.length; i++) this.layers[i]!.update?.(dt, f);
  }

  render(): void {
    const f = this.frame;
    const d = f.layout.dpr;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    for (let i = 0; i < this.layers.length; i++) this.layers[i]!.draw(f);
  }
}
