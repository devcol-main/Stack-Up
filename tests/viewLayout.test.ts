import { describe, expect, it } from 'vitest';
import {
  cameraTarget, clampDpr, computeLayout, levelToY, stepCamera, worldToScreenW, worldToScreenX,
} from '../src/view/layout';

describe('layout', () => {
  it('dpr above 2 is clamped to 2 and invalid dpr falls back to 1', () => {
    expect(clampDpr(3)).toBe(2);
    expect(clampDpr(1.5)).toBe(1.5);
    expect(clampDpr(0)).toBe(1);
    expect(clampDpr(NaN)).toBe(1);
  });

  it('portrait screen narrower than 9:16 uses the full width as play area', () => {
    const l = computeLayout(300, 800, 1);
    expect(l.playW).toBe(300);
    expect(l.playX).toBe(0);
  });

  it('wide screen limits the play area to a centered 9:16 strip', () => {
    const l = computeLayout(1600, 900, 2);
    expect(l.playW).toBeCloseTo(900 * 9 / 16);
    expect(l.playX).toBeCloseTo((1600 - l.playW) / 2);
  });

  it('mockup-sized screen gives mockup block height and follow level', () => {
    const l = computeLayout(270, 480, 1);
    expect(l.blockH).toBeCloseTo(22);
    expect(l.baseY).toBeCloseTo(410);
    expect(l.followLevels).toBe(9);
  });

  it('zero-sized canvas does not produce NaN layout', () => {
    const l = computeLayout(0, 0, 1);
    expect(Number.isFinite(l.blockH)).toBe(true);
    expect(Number.isFinite(l.baseY)).toBe(true);
  });

  it('normalized x and width map into the play area', () => {
    const l = computeLayout(1600, 900, 1);
    expect(worldToScreenX(l, 0)).toBeCloseTo(l.playX);
    expect(worldToScreenX(l, 1)).toBeCloseTo(l.playX + l.playW);
    expect(worldToScreenW(l, 0.5)).toBeCloseTo(l.playW / 2);
  });

  it('level 0 sits at baseY and each level goes up one block height', () => {
    const l = computeLayout(270, 480, 1);
    expect(levelToY(l, 0, 0)).toBeCloseTo(l.baseY);
    expect(levelToY(l, 3, 0)).toBeCloseTo(l.baseY - 3 * l.blockH);
  });

  it('raising the camera moves every level down on screen', () => {
    const l = computeLayout(270, 480, 1);
    expect(levelToY(l, 5, 2)).toBeCloseTo(levelToY(l, 5, 0) + 2 * l.blockH);
  });

  it('camera target stays at 0 until the stack passes the follow level', () => {
    expect(cameraTarget(0, 9)).toBe(0);
    expect(cameraTarget(8, 9)).toBe(0);
    expect(cameraTarget(9, 9)).toBe(1);
    expect(cameraTarget(20, 9)).toBe(12);
  });

  it('camera step moves toward the target without overshooting', () => {
    let cam = 0;
    for (let i = 0; i < 10; i++) {
      const next = stepCamera(cam, 10, 1 / 60);
      expect(next).toBeGreaterThan(cam);
      expect(next).toBeLessThanOrEqual(10);
      cam = next;
    }
    expect(stepCamera(0, 10, 100)).toBe(10); // 큰 dt도 목표를 넘지 않음
  });
});
