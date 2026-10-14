import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../../../shared/leaderboard';
import { createPlayerProfile, createStackUpLeaderboard, sanitizeStackUpStats } from '../src/ui/leaderboard';
import { UI_CONFIG } from '../src/ui/uiConfig';

function memStorage(init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k]! : null), setItem: (k, v) => void (data[k] = v) };
}

describe('stack-up leaderboard wiring', () => {
  it('service uses gameId stack-up and the existing stackup.leaderboard key', async () => {
    const s = memStorage();
    const lb = createStackUpLeaderboard(s);
    expect(lb.gameId).toBe('stack-up');
    await lb.submit({ playerId: 'p', nickname: 'Neo', score: 10, stats: { floors: 4, maxCombo: 2 }, ts: 1 });
    expect(Object.keys(s.data)).toEqual(['stackup.leaderboard']);
  });

  it('pre-redesign stored records still appear with score, floors, maxCombo and nickname', async () => {
    const s = memStorage({ [UI_CONFIG.leaderboardKey]: JSON.stringify([{ nickname: 'Ann', score: 480, floors: 17, maxCombo: 6, ts: 5 }]) });
    expect(await createStackUpLeaderboard(s).getTop(10)).toEqual([
      { playerId: '', nickname: 'Ann', score: 480, stats: { floors: 17, maxCombo: 6 }, ts: 5 },
    ]);
  });

  it('stats sanitizer reads both new and old shapes and defaults missing values to 0', () => {
    expect(sanitizeStackUpStats({ stats: { floors: 3, maxCombo: 1 } })).toEqual({ floors: 3, maxCombo: 1 });
    expect(sanitizeStackUpStats({ floors: 3, maxCombo: 1 })).toEqual({ floors: 3, maxCombo: 1 });
    expect(sanitizeStackUpStats(undefined)).toEqual({ floors: 0, maxCombo: 0 });
  });

  it('legacy stackup.nickname is imported into the shared profile', () => {
    const s = memStorage({ 'stackup.nickname': 'Neo' });
    expect(createPlayerProfile(s).nickname).toBe('Neo');
    expect(s.data['devcol.player.nickname']).toBe('Neo');
  });
});

describe('stack-up nickname after Reset', () => {
  it('Reset leaves the profile nickname untouched and an empty input falls back to it instead of Anonymous', async () => {
    const { nicknameToSubmit } = await import('../src/ui/leaderboard');
    const { resetUserData } = await import('../src/ui/options');
    const { BestScore } = await import('../src/ui/records');
    const s = memStorage({ 'devcol.player.nickname': 'Neo' });
    resetUserData({ best: new BestScore(s, UI_CONFIG.bestKey), storage: s, leaderboardKey: UI_CONFIG.leaderboardKey });
    const profile = createPlayerProfile(s);
    expect(profile.nickname).toBe('Neo');
    expect(nicknameToSubmit('', profile.nickname)).toBe('Neo');
    expect(nicknameToSubmit('  ', profile.nickname)).toBe('Neo');
    expect(nicknameToSubmit('Trin', profile.nickname)).toBe('Trin');
    expect(nicknameToSubmit('', '')).toBe('Anonymous');
  });
});
