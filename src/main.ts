// 임시 진입점 (하위 작업 3: view 확인용). 화면 흐름/입력/UI는 하위 작업 6에서 교체한다.
import { createRng } from './core/rng';
import { StackUpLogic } from './core/StackUpLogic';
import { StackUpRenderer } from './view/StackUpRenderer';

const canvas = document.getElementById('game');
if (canvas instanceof HTMLCanvasElement) {
  const logic = new StackUpLogic(createRng(Date.now()));
  const renderer = new StackUpRenderer(canvas, logic);

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
    logic.consumeEvents(renderer.onEvent);
    overTime = logic.isGameOver ? overTime + dt : 0;
    renderer.update(dt);
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
