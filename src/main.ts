import { LocalLeaderboardService, normalizeNickname, MAX_NICKNAME_LENGTH, type LeaderboardEntry, type LeaderboardService } from '../../../shared/leaderboard';
import { createRng } from './core/rng';
import { StackUpLogic, type StackUpEvent } from './core/StackUpLogic';
import { AudioManager } from './audio/AudioManager';
import { StackUpRenderer } from './view/StackUpRenderer';
import { GameFlow } from './ui/flow';
import { BestScore, NicknameStore, browserStorage } from './ui/records';
import { StackUpUi } from './ui/StackUpUi';
import { FrameClock } from './ui/frameClock';
import { waitForFont } from './ui/fonts';
import { UI_CONFIG } from './ui/uiConfig';
import './ui/ui.css';

const canvas = document.getElementById('game');
if (canvas instanceof HTMLCanvasElement) {
  const storage = browserStorage();
  const logic = new StackUpLogic(createRng(Date.now()));
  const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const renderer = new StackUpRenderer(canvas, logic, { reducedMotion: motionQuery?.matches ?? false });
  motionQuery?.addEventListener('change', (e) => renderer.setReducedMotion(e.matches));

  const audio = new AudioManager();
  const flow = new GameFlow(UI_CONFIG.gameOverInputLockSec);
  const ui = new StackUpUi(UI_CONFIG.leaderboardSize);
  const best = new BestScore(storage, UI_CONFIG.bestKey);
  const nickname = new NicknameStore(storage, UI_CONFIG.nicknameKey, MAX_NICKNAME_LENGTH);
  const leaderboard: LeaderboardService = new LocalLeaderboardService(UI_CONFIG.leaderboardKey);
  ui.setMuted(audio.isMuted());

  /** 이번 판의 결과 (게임 오버 이벤트에서 채움). 제출은 flow.claimSubmit()으로 판당 1회. */
  const result = { score: 0, floors: 0, maxCombo: 0 };

  const refreshBoard = (mine: LeaderboardEntry | null): void => {
    const round = flow.round;
    leaderboard.getTop(UI_CONFIG.leaderboardSize).then(
      (entries) => {
        // 그 사이 재시작했거나 다른 판이면 버린다
        if (flow.round === round && flow.phase === 'gameOver') ui.renderBoard(entries, mine);
      },
      () => {},
    );
  };

  const submitScore = (): void => {
    if (!flow.claimSubmit()) return;
    const nick = normalizeNickname(ui.input.value);
    nickname.save(nick);
    const entry: LeaderboardEntry = { nickname: nick, score: result.score, floors: result.floors, maxCombo: result.maxCombo, ts: Date.now() };
    ui.hideNickForm();
    leaderboard.submit(entry).then(
      () => refreshBoard(entry),
      () => refreshBoard(null),
    );
  };

  // 프레임 루프 밖에서 한 번만 생성 (루프 안 클로저 할당 방지)
  const onEvent = (ev: StackUpEvent): void => {
    renderer.onEvent(ev);
    audio.onEvent(ev);
    if (ev.type === 'perfect') {
      ui.flashPerfect(ev.combo);
    } else if (ev.type === 'gameOver' && flow.endGame()) {
      result.score = ev.score;
      result.floors = ev.floors;
      result.maxCombo = ev.maxCombo;
      best.submit(ev.score);
      ui.setPhase('gameOver');
      ui.showGameOver({ score: ev.score, best: best.value }, nickname.value);
      refreshBoard(null);
    }
  };

  const isTextTarget = (t: EventTarget | null): boolean => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

  /** 입력 순서: unlock → 상태 기계. 닉네임/버튼 같은 UI 요소(data-ui)는 게임 입력으로 취급하지 않는다. */
  const onTap = (): void => {
    const action = flow.tap();
    if (action === 'start' || action === 'retry') {
      // 숨겨질 닉네임 입력에 포커스가 남아 다음 판 Space가 막히지 않게
      const active = document.activeElement;
      if (active instanceof HTMLElement && (isTextTarget(active) || active === ui.retryButton)) active.blur();
      logic.reset();
      audio.unduck();
      renderer.reset();
      ui.setScore(0);
      ui.setPhase('playing');
    } else if (action === 'drop') {
      logic.drop();
    }
  };

  // iframe 안에서도 키보드(Space)가 먹도록 첫 포인터 입력에서 포커스를 가져온다.
  const grabFocus = (): void => {
    try {
      window.focus();
      canvas.focus({ preventScroll: true });
    } catch {
      // 포커스 불가 환경은 무시
    }
  };
  window.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest('[data-ui]')) return;
    grabFocus();
    e.preventDefault();
    onTap();
  });
  window.addEventListener('keydown', (e) => {
    audio.unlock();
    if (isTextTarget(e.target)) return; // 닉네임 입력 중에는 스페이스/M이 게임으로 새지 않는다
    if (e.code === 'KeyM' && !e.repeat) toggleMute();
    // 포커스된 버튼(retry/Submit/Sound)의 Space/Enter는 각 버튼의 click/submit 핸들러만 처리한다.
    // keydown까지 게임 입력으로 처리하면 이중 처리된다(재시작 직후 drop, 점수 미제출, 음소거+drop).
    if (e.target instanceof HTMLElement && e.target.closest('button')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) onTap();
    }
  });

  const toggleMute = (): void => {
    ui.setMuted(audio.toggleMute());
  };
  ui.muteButton.addEventListener('click', () => {
    toggleMute();
    ui.muteButton.blur(); // 이후 스페이스가 버튼을 누르지 않게
  });
  // 키보드(Enter/Space로 버튼 활성화)로 누른 click만 처리. 포인터는 pointerdown에서 이미 처리됨(detail 0 = 키보드).
  ui.retryButton.addEventListener('click', (e) => {
    if (e.detail === 0) onTap();
  });
  ui.form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitScore();
    ui.input.blur();
  });

  // 리사이즈: window resize, iframe 크기 변경(ResizeObserver), 모바일 주소창/키보드(visualViewport)를 모두 받아
  // 프레임당 한 번만 처리한다(글로우 스프라이트 재생성 폭주 방지).
  let resizeDirty = false;
  const markResize = (): void => {
    resizeDirty = true;
  };
  window.addEventListener('resize', markResize);
  window.visualViewport?.addEventListener('resize', markResize);
  if (typeof ResizeObserver === 'function') new ResizeObserver(markResize).observe(canvas);

  // 폰트가 준비되면(실패/타임아웃 포함) UI를 보여준다. 게임 루프는 기다리지 않는다.
  void waitForFont().then(() => ui.show());

  // 일시정지: 탭이 숨겨지면 dt를 0으로 두고(게임/이펙트/입력 잠금 시간 모두 정지) 오디오를 멈춘다.
  const clock = new FrameClock(UI_CONFIG.maxFrameDt);
  const setPaused = (paused: boolean): void => {
    if (paused === clock.isPaused) return;
    if (paused) {
      clock.pause();
      audio.suspend();
    } else {
      clock.resume();
      audio.resume();
    }
  };
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));
  window.addEventListener('pagehide', () => setPaused(true));
  window.addEventListener('pageshow', () => setPaused(document.hidden));
  if (document.hidden) setPaused(true);

  const frame = (now: number): void => {
    const dt = clock.tick(now);
    if (resizeDirty) {
      resizeDirty = false;
      renderer.resize();
    }
    logic.update(dt);
    logic.consumeEvents(onEvent);
    flow.update(dt);
    ui.setScore(logic.score);
    renderer.update(dt);
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
