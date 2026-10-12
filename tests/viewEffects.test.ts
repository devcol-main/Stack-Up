import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { Effects, easeOutCubic, gridFlickerAlpha, shakeOffset } from '../src/view/effects';
import { StarField, wrap01 } from '../src/view/stars';
import { VIEW_CONFIG } from '../src/view/viewConfig';

const make = (reduced = false): Effects => {
  const fx = new Effects(createRng(1));
  fx.reducedMotion = reduced;
  return fx;
};

describe('wrap01', () => {
  it('values outside 0..1 wrap into [0, 1) including negatives', () => {
    expect(wrap01(1.25)).toBeCloseTo(0.25);
    expect(wrap01(-0.25)).toBeCloseTo(0.75);
    expect(wrap01(1)).toBe(0);
  });
});

describe('StarField', () => {
  const H = 480;
  it('star positions always stay inside the screen however high the camera goes', () => {
    const f = new StarField(createRng(3));
    for (let step = 0; step < 50; step++) {
      f.update(0.5, 1);
      for (let l = 0; l < f.layerCount; l++) {
        for (let i = f.starts[l]!; i < f.starts[l + 1]!; i++) {
          const y = f.screenY(i, l, step * 3.7, 20, H);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(H);
        }
      }
    }
  });

  it('flow scale 0 keeps stars still and a smaller scale flows slower', () => {
    const a = new StarField(createRng(3));
    const b = new StarField(createRng(3));
    a.update(2, 0);
    b.update(2, 1);
    expect(a.scroll[0]).toBe(0);
    expect(b.scroll[0]).toBeGreaterThan(0);
  });

  it('deeper layers move less than near layers when the camera rises', () => {
    const f = new StarField(createRng(3));
    const dy = (l: number): number => {
      const i = f.starts[l]!;
      return (f.screenY(i, l, 1, 20, H) - f.screenY(i, l, 0, 20, H) + H) % H;
    };
    expect(dy(0)).toBeLessThan(dy(f.layerCount - 1));
  });
});

describe('shakeOffset', () => {
  it('amplitude decays over time and is exactly zero after the duration', () => {
    const early = Math.abs(shakeOffset(0.01, 0.4, 1, 20, Math.PI / 2));
    const late = Math.abs(shakeOffset(0.35, 0.4, 1, 20, Math.PI / 2));
    expect(early).toBeGreaterThan(late);
    expect(shakeOffset(0.4, 0.4, 1, 20, 0)).toBe(0);
    expect(shakeOffset(1, 0.4, 1, 20, 0)).toBe(0);
  });
});

describe('easeOutCubic', () => {
  it('starts at 0, ends at 1 and moves faster at the beginning', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
  });
});

describe('gridFlickerAlpha', () => {
  it('stays within [base*(1-depth), base] and flickers less with reduced motion', () => {
    let min = Infinity, max = -Infinity, rMin = Infinity, rMax = -Infinity;
    for (let t = 0; t < 20; t += 0.05) {
      const a = gridFlickerAlpha(t, false);
      const r = gridFlickerAlpha(t, true);
      min = Math.min(min, a); max = Math.max(max, a);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    }
    expect(max).toBeLessThanOrEqual(VIEW_CONFIG.gridAlpha + 1e-9);
    expect(min).toBeGreaterThanOrEqual(VIEW_CONFIG.gridAlpha * (1 - VIEW_CONFIG.gridFlickerDepth) - 1e-9);
    expect(rMax - rMin).toBeLessThan(max - min);
  });
});

describe('Effects', () => {
  it('perfect spawns one ring and particles that expire after their life', () => {
    const fx = make();
    fx.spawnPerfect(0.3, 0.4, 5, 2, 3);
    expect(fx.activeRings).toBe(1);
    expect(fx.activeParticles).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) fx.update(0.02);
    expect(fx.activeParticles).toBe(0);
    expect(fx.activeRings).toBe(0);
  });

  it('particles rise first and then fall under gravity', () => {
    const fx = make();
    fx.spawnPerfect(0.3, 0.4, 5, 0, 1);
    const p = fx.particles.find((q) => q.active)!;
    const y0 = p.y;
    fx.update(0.05);
    expect(p.y).toBeGreaterThan(y0);
    const vy = p.vy;
    for (let i = 0; i < 10; i++) fx.update(0.05);
    expect(p.vy).toBeLessThan(vy);
  });

  it('particle count grows with combo up to the configured max', () => {
    const lo = make();
    lo.spawnPerfect(0, 0.4, 1, 0, 1);
    const hi = make();
    hi.spawnPerfect(0, 0.4, 1, 0, 100);
    expect(hi.activeParticles).toBe(VIEW_CONFIG.perfectParticlesMax);
    expect(lo.activeParticles).toBeLessThan(hi.activeParticles);
  });

  it('reduced motion spawns fewer particles and a smaller ring', () => {
    const full = make();
    const red = make(true);
    full.spawnPerfect(0, 0.4, 1, 0, 5);
    red.spawnPerfect(0, 0.4, 1, 0, 5);
    expect(red.activeParticles).toBeLessThan(full.activeParticles);
    expect(red.rings.find((r) => r.active)!.scale).toBeLessThan(full.rings.find((r) => r.active)!.scale);
  });

  it('regrow with zero amount spawns nothing', () => {
    const fx = make();
    fx.spawnRegrow(0.2, 0.5, 4, 0, 1);
    expect(fx.activeFlashes).toBe(0);
    expect(fx.activeParticles).toBe(0);
  });

  it('regrow with positive amount spawns a flash and edge particles', () => {
    const fx = make();
    fx.spawnRegrow(0.2, 0.5, 4, 0.04, 1);
    expect(fx.activeFlashes).toBe(1);
    expect(fx.activeParticles).toBeGreaterThan(0);
  });

  it('land flash expires after its duration', () => {
    const fx = make();
    fx.spawnLand(0.2, 0.5, 4, 1);
    expect(fx.activeFlashes).toBe(1);
    fx.update(VIEW_CONFIG.flashDuration + 0.01);
    expect(fx.activeFlashes).toBe(0);
  });

  it('full particle pool reuses slots instead of growing', () => {
    const fx = make();
    for (let i = 0; i < 50; i++) fx.spawnPerfect(0, 0.4, 1, 0, 100);
    expect(fx.particles.length).toBe(VIEW_CONFIG.particlePoolSize);
    expect(fx.activeParticles).toBe(VIEW_CONFIG.particlePoolSize);
  });

  it('shake moves the offset right after start and returns to zero afterwards', () => {
    const fx = make();
    fx.startShake();
    fx.update(0.02);
    expect(Math.abs(fx.shake.x) + Math.abs(fx.shake.y)).toBeGreaterThan(0);
    fx.update(VIEW_CONFIG.shakeDuration);
    fx.update(0.016);
    expect(fx.shake.x).toBe(0);
    expect(fx.shake.y).toBe(0);
  });

  it('reduced motion ignores shake', () => {
    const fx = make(true);
    fx.startShake();
    fx.update(0.02);
    expect(fx.shake.x).toBe(0);
    expect(fx.shake.y).toBe(0);
  });

  it('clear deactivates everything and stops the shake', () => {
    const fx = make();
    fx.spawnPerfect(0, 0.4, 1, 0, 3);
    fx.spawnLand(0, 0.4, 1, 0);
    fx.startShake();
    fx.update(0.02);
    fx.clear();
    expect(fx.activeParticles + fx.activeRings + fx.activeFlashes).toBe(0);
    expect(fx.shake.x).toBe(0);
  });
});
