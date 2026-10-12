// VFX 상태: 입자/링/외곽선 플래시 풀 + 화면 흔들림. 순수 계산 (DOM 없음), 고정 크기 풀.
// 좌표는 "월드" 기준: x = core 정규화 x(플레이 폭 단위), y = 층 단위(위가 +, 블록 윗면이 정수 층).
// 그래서 카메라가 움직이거나 리사이즈돼도 연출이 블록에 붙어 있다.
import { VIEW_CONFIG } from './viewConfig';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  /** 플레이 폭/초. */
  vx: number;
  /** 층(blockH)/초, 위가 +. */
  vy: number;
  life: number;
  maxLife: number;
  colorIndex: number;
}

export interface Ring {
  active: boolean;
  x: number;
  y: number;
  t: number;
  dur: number;
  scale: number;
  colorIndex: number;
}

export interface Flash {
  active: boolean;
  x: number;
  w: number;
  level: number;
  t: number;
  dur: number;
  /** 0 = 안착 플래시, >0 = 폭 회복 (늘어난 정규화 폭). */
  grow: number;
  colorIndex: number;
}

export interface Shake {
  elapsed: number;
  duration: number;
  /** blockH 단위. */
  amp: number;
  /** 현재 오프셋 (blockH 단위). */
  x: number;
  y: number;
}

export function easeOutCubic(t: number): number {
  const k = 1 - t;
  return 1 - k * k * k;
}

/** 흔들림 한 축의 오프셋. 시간이 지나면 제곱으로 감쇠하고 duration 이후 0. */
export function shakeOffset(elapsed: number, duration: number, amp: number, freq: number, phase: number): number {
  if (duration <= 0 || elapsed >= duration || elapsed < 0) return 0;
  const k = 1 - elapsed / duration;
  return amp * k * k * Math.sin(elapsed * freq * Math.PI * 2 + phase);
}

function acquire<T extends { active: boolean }>(items: T[], age: (item: T) => number): T {
  let worst = items[0]!;
  let worstAge = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (!it.active) return it;
    const a = age(it);
    if (a > worstAge) {
      worstAge = a;
      worst = it;
    }
  }
  return worst;
}

const particleAge = (p: Particle): number => p.maxLife - p.life;
const ringAge = (r: Ring): number => r.t / r.dur;
const flashAge = (f: Flash): number => f.t / f.dur;

function countActive(items: readonly { active: boolean }[]): number {
  let n = 0;
  for (let i = 0; i < items.length; i++) if (items[i]!.active) n++;
  return n;
}

export class Effects {
  readonly particles: Particle[] = [];
  readonly rings: Ring[] = [];
  readonly flashes: Flash[] = [];
  readonly shake: Shake = { elapsed: 0, duration: 0, amp: 0, x: 0, y: 0 };
  /** true면 흔들림 없음, 입자/링 축소. */
  reducedMotion = false;

  constructor(private readonly random: () => number = Math.random) {
    const c = VIEW_CONFIG;
    for (let i = 0; i < Math.max(1, c.particlePoolSize); i++) {
      this.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, colorIndex: 0 });
    }
    for (let i = 0; i < Math.max(1, c.ringPoolSize); i++) {
      this.rings.push({ active: false, x: 0, y: 0, t: 0, dur: 1, scale: 1, colorIndex: 0 });
    }
    for (let i = 0; i < Math.max(1, c.flashPoolSize); i++) {
      this.flashes.push({ active: false, x: 0, w: 0, level: 0, t: 0, dur: 1, grow: 0, colorIndex: 0 });
    }
  }

  get activeParticles(): number {
    return countActive(this.particles);
  }
  get activeRings(): number {
    return countActive(this.rings);
  }
  get activeFlashes(): number {
    return countActive(this.flashes);
  }

  /** 블록 안착: 외곽선 플래시. */
  spawnLand(x: number, w: number, level: number, colorIndex: number): void {
    const f = acquire(this.flashes, flashAge);
    f.active = true;
    f.x = x;
    f.w = w;
    f.level = level;
    f.t = 0;
    f.dur = VIEW_CONFIG.flashDuration;
    f.grow = 0;
    f.colorIndex = colorIndex;
  }

  /** Perfect: 링 파동 + 윗면에서 튀는 입자. combo가 클수록 입자 증가. */
  spawnPerfect(x: number, w: number, level: number, colorIndex: number, combo: number): void {
    const c = VIEW_CONFIG;
    const r = acquire(this.rings, ringAge);
    r.active = true;
    r.x = x + w / 2;
    r.y = level - 0.5;
    r.t = 0;
    r.dur = c.ringDuration;
    r.scale = this.reducedMotion ? c.reducedRingScale : 1;
    r.colorIndex = colorIndex;
    const base = Math.min(c.perfectParticlesMax, c.perfectParticlesBase + combo * c.perfectParticlesPerCombo);
    this.burst(x, w, level, colorIndex, this.scaled(base));
  }

  /** 콤보 5 단위 폭 회복. amount <= 0이면 아무것도 하지 않는다. */
  spawnRegrow(x: number, w: number, level: number, amount: number, colorIndex: number): void {
    if (!(amount > 0)) return;
    const f = acquire(this.flashes, flashAge);
    f.active = true;
    f.x = x;
    f.w = w;
    f.level = level;
    f.t = 0;
    f.dur = VIEW_CONFIG.regrowDuration;
    f.grow = amount;
    f.colorIndex = colorIndex;
    // 늘어난 양 끝에서 입자가 바깥으로 나간다.
    const n = this.scaled(VIEW_CONFIG.regrowParticles);
    for (let i = 0; i < n; i++) {
      const left = (i & 1) === 0;
      const p = this.newParticle(left ? x : x + w, level - 0.5, colorIndex);
      p.vx = (left ? -1 : 1) * (0.2 + this.random() * VIEW_CONFIG.particleSpeedX * 0.6);
    }
  }

  /** 게임 오버 흔들림. reduced motion이면 무시. */
  startShake(): void {
    if (this.reducedMotion) return;
    const s = this.shake;
    s.elapsed = 0;
    s.duration = VIEW_CONFIG.shakeDuration;
    s.amp = VIEW_CONFIG.shakeAmplitude;
  }

  cancelShake(): void {
    const s = this.shake;
    s.elapsed = 0;
    s.duration = 0;
    s.x = 0;
    s.y = 0;
  }

  update(dt: number): void {
    const c = VIEW_CONFIG;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy -= c.particleGravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i]!;
      if (!r.active) continue;
      r.t += dt;
      if (r.t >= r.dur) r.active = false;
    }
    for (let i = 0; i < this.flashes.length; i++) {
      const f = this.flashes[i]!;
      if (!f.active) continue;
      f.t += dt;
      if (f.t >= f.dur) f.active = false;
    }
    const s = this.shake;
    if (s.elapsed < s.duration) {
      s.elapsed += dt;
      s.x = shakeOffset(s.elapsed, s.duration, s.amp, c.shakeFreq, 0);
      s.y = shakeOffset(s.elapsed, s.duration, s.amp, c.shakeFreq * 1.3, 1.7);
    } else {
      s.x = 0;
      s.y = 0;
    }
  }

  clear(): void {
    for (let i = 0; i < this.particles.length; i++) this.particles[i]!.active = false;
    for (let i = 0; i < this.rings.length; i++) this.rings[i]!.active = false;
    for (let i = 0; i < this.flashes.length; i++) this.flashes[i]!.active = false;
    const s = this.shake;
    s.elapsed = 0;
    s.duration = 0;
    s.x = 0;
    s.y = 0;
  }

  private scaled(n: number): number {
    if (!this.reducedMotion) return n;
    return Math.max(2, Math.round(n * VIEW_CONFIG.reducedParticleScale));
  }

  private burst(x: number, w: number, level: number, colorIndex: number, n: number): void {
    const c = VIEW_CONFIG;
    for (let i = 0; i < n; i++) {
      const p = this.newParticle(x + this.random() * w, level, colorIndex);
      p.vx = (this.random() - 0.5) * 2 * c.particleSpeedX;
    }
  }

  private newParticle(x: number, y: number, colorIndex: number): Particle {
    const c = VIEW_CONFIG;
    const p = acquire(this.particles, particleAge);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = c.particleUp + this.random() * c.particleUpJitter;
    p.maxLife = c.particleLife + this.random() * c.particleLifeJitter;
    p.life = p.maxLife;
    p.colorIndex = colorIndex;
    return p;
  }
}

/** 그리드 알파: 기본값 주변에서 천천히 깜박임 (depth = 0이면 고정). 항상 [base*(1-depth), base]. */
export function gridFlickerAlpha(time: number, reducedMotion: boolean): number {
  const c = VIEW_CONFIG;
  const depth = reducedMotion ? c.gridFlickerDepthReduced : c.gridFlickerDepth;
  const wave = 0.5 + 0.5 * Math.sin(time * c.gridFlickerSpeed);
  return c.gridAlpha * (1 - depth + depth * wave);
}
