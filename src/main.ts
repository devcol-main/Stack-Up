// 골격 확인용 임시 진입점. 하위 작업 2~6에서 게임 루프, 입력, 화면 흐름으로 교체한다.
const canvas = document.getElementById('game');
if (canvas instanceof HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#07020F');
    bg.addColorStop(1, '#1D0634');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
