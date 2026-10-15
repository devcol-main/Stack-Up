// capture-media.mjs 가 쓰는 순수 헬퍼와 페이지 주입용 봇.

/**
 * 시나리오(16 drop): Perfect 1회, 잘림 2회(폭 축소), Perfect 11연속(5층 마일스톤, 콤보 5 폭 회복(8층), 10층 마일스톤, 콤보 10 폭 회복(13층), 약 12층부터 카메라 상승), 잘림 1회, 완전 빗나감.
 * 층마다 "아래 블록 x 기준 오프셋"(0 = Perfect), 'miss' = 완전히 빗나감. */
export const PLAN = [0, 0.1, -0.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.06, 'miss'];

/** README 용 샘플 리더보드 (LocalLeaderboardService 저장 형식: LeaderboardEntry[] JSON). */
export function sampleLeaderboard(baseTs = 1760000000000) {
  const names = ['NovaFox', 'PixelPup', 'ByteBard', 'LunaLoop', 'ArcadeAce', 'GlitchGoat', 'NeonNomad', 'TurboTofu', 'CosmicCat', 'ZenZapper', 'RetroRay'];
  return names.map((nickname, i) => ({
    nickname,
    score: 64 - i * 5,
    floors: 40 - i * 3,
    maxCombo: 12 - i,
    ts: baseTs + i * 60000,
  }));
}

/**
 * 스크린캐스트 프레임 → ffmpeg concat demuxer 목록.
 * frames: [{ file, t }] (t = 초, 오름차순). endT: 마지막 프레임이 끝나는 시각(초).
 * 같은 t가 겹치면 최소 간격으로 보정해 duration 0을 피한다.
 */
export function buildConcatList(frames, endT) {
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const next = i + 1 < frames.length ? frames[i + 1].t : endT;
    const dur = Math.max(next - frames[i].t, 0.001);
    lines.push(`file '${frames[i].file.replace(/'/g, "'\\''")}'`, `duration ${dur.toFixed(4)}`);
  }
  // concat demuxer는 마지막 파일을 한 번 더 적어야 마지막 duration이 적용된다.
  if (frames.length > 0) lines.push(`file '${frames[frames.length - 1].file.replace(/'/g, "'\\''")}'`);
  return lines.join('\n') + '\n';
}

/** GIF 인코딩 후보 (큰 것부터). MAX_GIF_BYTES(8MiB)를 넘으면 다음 후보로 내려간다. */
export const GIF_PRESETS = [
  { width: 360, fps: 14, colors: 128 },
  { width: 340, fps: 14, colors: 128 },
  { width: 320, fps: 12, colors: 96 },
  { width: 300, fps: 10, colors: 64 },
  { width: 260, fps: 10, colors: 48 },
];

export function ffmpegGifArgs(listFile, out, p) {
  const vf = `fps=${p.fps},scale=${p.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${p.colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  return ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', vf, '-loop', '0', out];
}

/**
 * 페이지 안에서 실행되는 봇 (Function.toString으로 주입 — 외부 변수 참조 금지).
 * rAF마다 window.__stackUp.logic을 읽고, 이동 블록이 목표 x에 가장 가까운 프레임에 Space keydown을 dispatch한다.
 * 한 프레임에 움직이는 거리(speed*dt)의 절반 이내면 drop -> 오차 <= 반 프레임 이동량.
 * (Perfect 허용치 = max(폭*4.5%, 0.006): 기본 폭 0.55에서 약 0.0248. 시나리오 구간(16층까지 속도 0.4~0.775)의 60fps 프레임 이동량은 최대 ~0.013이라 오차는 그 절반 이하. 단 게임이 dt를 0.05초로 자르는 긴 프레임이 고속 구간에 끼면 오차가 허용치를 넘을 수 있다)
 * opts: { plan, holdAtFloors (이 층수 도달 시 drop 멈추고 __bot.holding=true) }
 */
export function installBot(opts) {
  const st = { done: false, holding: false, released: false, drops: 0, last: 0, dt: 1 / 60, result: null };
  window.__bot = st;
  const press = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
  const tick = (now) => {
    const s = window.__stackUp.logic;
    if (st.last) st.dt = Math.min(Math.max((now - st.last) / 1000, 1 / 120), 0.05);
    st.last = now;
    if (s.isGameOver) {
      st.done = true;
      st.result = { score: s.score, floors: s.floors, maxCombo: s.maxCombo };
      return;
    }
    requestAnimationFrame(tick);
    const idx = s.floors;
    if (opts.holdAtFloors === idx && !st.released) {
      st.holding = true;
      return;
    }
    const step = opts.plan[idx];
    if (step === undefined) return;
    const cur = s.current;
    const top = s.top;
    // miss: 아래 블록 좌/우 어느 쪽이든 겹치지 않는 위치 중 현재 위치에서 가까운 쪽
    const missL = top.x - cur.w - 0.03;
    const missR = top.x + top.w + 0.03;
    let target = step === 'miss' ? (Math.abs(missL - cur.x) < Math.abs(missR - cur.x) ? missL : missR) : top.x + step;
    target = Math.min(Math.max(target, s.minX()), s.maxX());
    if (step === 'miss' && target < top.x + top.w && target + cur.w > top.x) {
      st.error = `miss target ${target.toFixed(3)} still overlaps the tower`; // 범위 클램프로 겹치게 된 경우
      return;
    }
    if (Math.abs(target - cur.x) <= cur.speed * st.dt * 0.55) {
      press();
      st.drops++;
    }
  };
  requestAnimationFrame(tick);
}
