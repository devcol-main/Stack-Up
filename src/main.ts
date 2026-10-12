// 임시 진입점 (하위 작업 3: view 확인용). 화면 흐름/입력/UI는 하위 작업 6에서 교체한다.
import { createRng } from './core/rng';
import { StackUpLogic, type StackUpEvent } from './core/StackUpLogic';
import { AudioManager } from './audio/AudioManager';
import { StackUpRenderer } from './view/StackUpRenderer';

const canvas = document.getElementById('game');
if (canvas instanceof HTMLCanvasElement) {
  const logic = new StackUpLogic(createRng(Date.now()));
  const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const renderer = new StackUpRenderer(canvas, logic, { reducedMotion: motionQuery?.matches ?? false });
  motionQuery?.addEventListener('change', (e) => renderer.setReducedMotion(e.matches));

  const audio = new AudioManager();
  // 첫 사용자 입력에서 AudioContext 생성/resume (자동 재생 정책). capture 단계라 drop 처리보다 먼저 실행된다.
  window.addEventListener('pointerdown', () => audio.unlock(), true);
  window.addEventListener('keydown', () => audio.unlock(), true);
  // 프레임마다 클로저를 만들지 않도록 한 번만 생성
  const onEvent = (ev: StackUpEvent): void => {
    renderer.onEvent(ev);
    audio.onEvent(ev);
  };

  // 임시: 게임 오버 직후 짧은 입력 무시 후 클릭으로 재시작.
  let overTime = 0;
  const act = (): void => {
    if (logic.isGameOver) {
      if (overTime > 0.3) {
        logic.reset();
        renderer.reset();
      }
    } else {
      logic.drop();
    }
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    act();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) audio.toggleMute(); // 임시 음소거 키 (UI 버튼은 하위 작업 6)
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      act();
    }
  });
  window.addEventListener('resize', () => renderer.resize());

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    logic.update(dt);
    logic.consumeEvents(onEvent);
    overTime = logic.isGameOver ? overTime + dt : 0;
    renderer.update(dt);
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
