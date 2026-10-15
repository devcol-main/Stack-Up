// README용 이미지/GIF 생성. 사용법: npm run media
//  - Vite 개발 서버를 임의 포트로 띄우고, 격리된 임시 프로필의 헤드리스 Chrome을 CDP(WebSocket)로 조작한다.
//  - Chrome 경로: /Applications/Google Chrome.app/... 또는 환경변수 CHROME_PATH. ffmpeg: /opt/homebrew/bin/ffmpeg 또는 PATH.
//  - 봇(자동 플레이)은 이 스크립트가 페이지에 주입한다(scripts/lib/media-lib.mjs). 게임 코드에는 없다.
//  - 시드 고정(?seed=7, 개발 서버에서만 동작). 산출물: docs/media/{title,gameplay,gameover,options}.png, stack-up.gif
import { createServer } from 'vite';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAN, GIF_PRESETS, buildConcatList, ffmpegGifArgs, installBot, sampleLeaderboard } from './lib/media-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/media');
const SEED = Number(process.env.MEDIA_SEED ?? 7);
if (!Number.isInteger(SEED)) {
  console.error(`MEDIA_SEED must be an integer (got "${process.env.MEDIA_SEED}")`);
  process.exit(1);
}
const W = 390;
const H = 844;
const MAX_GIF_BYTES = 8 * 1024 * 1024;
const SEND_TIMEOUT_MS = 15000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  // CHROME_PATH가 지정되면 그것만 쓴다(없는 경로면 기본 경로로 몰래 넘어가지 않고 오류).
  const env = process.env.CHROME_PATH;
  if (env) {
    if (!existsSync(env)) throw new Error(`CHROME_PATH does not exist: ${env}`);
    return env;
  }
  const def = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!existsSync(def)) throw new Error('Chrome not found. Install Google Chrome or set CHROME_PATH.');
  return def;
}

function findFfmpeg() {
  if (existsSync('/opt/homebrew/bin/ffmpeg')) return '/opt/homebrew/bin/ffmpeg';
  const r = spawnSync('ffmpeg', ['-version']);
  if (r.status === 0) return 'ffmpeg';
  throw new Error('ffmpeg not found (expected /opt/homebrew/bin/ffmpeg or in PATH).');
}

/** 최소 CDP 클라이언트. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    const failAll = (reason) => {
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error(`${p.method}: ${reason}`));
      }
      this.pending.clear();
    };
    ws.addEventListener('close', () => failAll('connection closed'));
    ws.addEventListener('error', () => failAll('connection error'));
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== undefined) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (p) clearTimeout(p.timer);
        if (p) (m.error ? p.reject(new Error(`${p.method}: ${m.error.message}`)) : p.resolve(m.result));
      } else if (m.method) {
        for (const h of this.handlers.get(m.method) ?? []) h(m.params);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error(`WebSocket failed: ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: timed out after ${SEND_TIMEOUT_MS}ms`));
      }, SEND_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, method, timer });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }
  on(method, fn) {
    this.handlers.set(method, [...(this.handlers.get(method) ?? []), fn]);
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }
  async waitFor(expression, timeoutMs, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await this.eval(expression)) return;
      await sleep(30);
    }
    throw new Error(`Timeout waiting for ${label}`);
  }
  /** 연결을 끊고 탭도 닫는다(이후 녹화에 영향 없게). */
  async close() {
    try {
      this.ws.close();
    } catch {}
    if (this.targetId) await fetch(`http://127.0.0.1:${this.port}/json/close/${this.targetId}`).catch(() => {});
  }
}

/** holder.proc에 프로세스를 즉시 넘겨, 대기 중 실패해도 cleanup이 항상 kill할 수 있게 한다. */
async function launchChrome(userDataDir, holder) {
  const proc = spawn(
    findChrome(),
    [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`, '--mute-audio', '--hide-scrollbars',
      '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  holder.proc = proc;
  holder.exited = new Promise((r) => proc.once('exit', r));
  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    const timer = setTimeout(() => rej(new Error('Chrome did not report a DevTools address in time')), 20000);
    proc.on('error', (e) => {
      clearTimeout(timer);
      rej(new Error(`Failed to start Chrome: ${e.message}`));
    });
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        res(m[1]);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      rej(new Error(`Chrome exited early (code ${code}): ${buf.slice(-300)}`));
    });
  });
  return { port: new URL(wsUrl).port };
}

/** 새 탭을 열고 CDP 세션을 돌려준다. */
async function openPage(port, scale) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = await res.json();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  cdp.targetId = target.id;
  cdp.port = port;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: scale, mobile: true });
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  return cdp;
}

/** 샘플 리더보드/최고 기록을 심고 게임을 열어 UI가 준비될 때까지 기다린다. */
async function loadGame(cdp, url) {
  const board = JSON.stringify(sampleLeaderboard());
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.clear();localStorage.setItem('stackup.leaderboard',${JSON.stringify(board)});localStorage.setItem('stackup.best','64');}catch(e){}`,
  });
  await cdp.send('Page.navigate', { url });
  await cdp.waitFor(`document.getElementById('ui')?.classList.contains('ready') && !!window.__stackUp`, 15000, 'UI ready');
  await cdp.eval(`document.fonts.ready.then(() => true)`);
  await cdp.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
}

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = join(outDir, name);
  writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

const pressSpace = (cdp) => cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true,cancelable:true}))`);
const startBot = (cdp, holdAtFloors) => cdp.eval(`(${installBot})(${JSON.stringify({ plan: PLAN, holdAtFloors })})`);
const botResult = (cdp) => cdp.eval(`JSON.stringify(window.__bot.result)`);
/** 봇이 조건을 만족하거나 오류(__bot.error)를 내면 반환. 오류면 throw. */
async function waitBot(cdp, cond, timeoutMs, label) {
  await cdp.waitFor(`window.__bot.error || (${cond})`, timeoutMs, label);
  const err = await cdp.eval(`window.__bot.error || null`);
  if (err) throw new Error(`Bot error: ${err}`);
}
const waitBoard = (cdp) => cdp.waitFor(`document.querySelector('#board li:not([hidden])') !== null && document.querySelector('.ui').dataset.phase === 'gameOver'`, 10000, 'game over board');

async function captureStills(port, url, outputs) {
  const cdp = await openPage(port, 2);
  try {
    await loadGame(cdp, url);
    outputs.push(await shot(cdp, 'title.png'));

    await cdp.eval(`document.getElementById('options-btn').click()`);
    await cdp.waitFor(`!document.getElementById('options').hidden`, 3000, 'options panel');
    await sleep(500);
    outputs.push(await shot(cdp, 'options.png'));
    await cdp.eval(`document.getElementById('opt-close').click()`);
    await cdp.waitFor(`document.getElementById('options').hidden`, 3000, 'options close');

    await pressSpace(cdp); // 타이틀 첫 탭 = 시작
    await startBot(cdp, 10); // 10층 도달(Perfect + 마일스톤 + 카메라 상승) 순간에 멈춘다
    await waitBot(cdp, 'window.__bot.holding', 30000, 'bot reaching floor 10');
    await sleep(120);
    outputs.push(await shot(cdp, 'gameplay.png'));
    await cdp.eval(`window.__bot.released = true; window.__bot.holding = false`);
    await waitBot(cdp, 'window.__bot.done', 30000, 'bot finishing');
    await waitBoard(cdp);
    await sleep(1200);
    outputs.push(await shot(cdp, 'gameover.png'));
    return await botResult(cdp);
  } finally {
    await cdp.close();
  }
}

async function captureGif(port, url, tmp, outputs) {
  const cdp = await openPage(port, 1);
  const framesDir = join(tmp, 'frames');
  mkdirSync(framesDir);
  try {
    await loadGame(cdp, url);
    const frames = [];
    let n = 0;
    cdp.on('Page.screencastFrame', (p) => {
      const file = join(framesDir, `f${String(n++).padStart(5, '0')}.jpg`);
      writeFileSync(file, Buffer.from(p.data, 'base64'));
      frames.push({ file, t: p.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    await sleep(450); // 타이틀 장면
    await pressSpace(cdp);
    await startBot(cdp, -1);
    await waitBot(cdp, 'window.__bot.done', 40000, 'bot finishing');
    await waitBoard(cdp);
    await sleep(2500); // 게임 오버/Top 10 장면
    await cdp.send('Page.stopScreencast');
    const result = await botResult(cdp);
    if (frames.length < 10) throw new Error(`Too few screencast frames: ${frames.length}`);
    const endT = frames[frames.length - 1].t + 0.5;
    const list = join(tmp, 'frames.txt');
    writeFileSync(list, buildConcatList(frames, endT));
    const ffmpeg = findFfmpeg();
    const out = resolve(outDir, 'stack-up.gif');
    let ok = false;
    for (const p of GIF_PRESETS) {
      const r = spawnSync(ffmpeg, ffmpegGifArgs(list, out, p), { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
      const size = statSync(out).size;
      console.log(`gif ${p.width}px ${p.fps}fps ${p.colors} colors: ${(size / 1024 / 1024).toFixed(2)} MB (${frames.length} source frames, ${(endT - frames[0].t).toFixed(1)}s)`);
      if (size <= MAX_GIF_BYTES) {
        ok = true;
        break;
      }
    }
    if (!ok) console.warn('WARNING: GIF is larger than 8MB even at the smallest preset.');
    outputs.push(out);
    return result;
  } finally {
    await cdp.close();
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'devcol-media-'));
  const profile = join(tmp, 'profile'); // 사용자의 실제 프로필과 분리된 임시 user-data-dir
  mkdirSync(profile);
  let server = null;
  const chrome = { proc: null, exited: null };
  const cleanup = async () => {
    try {
      if (chrome.proc && chrome.proc.exitCode === null) {
        chrome.proc.kill('SIGKILL');
        await Promise.race([chrome.exited, sleep(3000)]); // 종료를 기다린 뒤 프로필 삭제
      }
    } catch {}
    try {
      await server?.close();
    } catch {}
    try {
      rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); // tmp는 mkdtemp가 만든 경로뿐
    } catch (e) {
      console.warn(`WARNING: could not remove temp dir ${tmp}: ${e.message}`);
    }
  };
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    process.on(sig, () => {
      cleanup().finally(() => process.exit(code));
    });
  }
  try {
    server = await createServer({
      root,
      logLevel: 'warn',
      server: { host: '127.0.0.1', port: 0, strictPort: true },
    });
    await server.listen();
    const addr = server.httpServer.address();
    const url = `http://127.0.0.1:${addr.port}/?seed=${SEED}`;
    console.log(`dev server: ${url}`);
    const { port } = await launchChrome(profile, chrome);
    const outputs = [];
    const stills = await captureStills(port, url, outputs);
    console.log(`stills run result: ${stills}`);
    const gif = await captureGif(port, url, tmp, outputs);
    console.log(`gif run result:    ${gif}`);
    console.log('\nOutputs:');
    for (const f of outputs) console.log(`  ${f.replace(root + '/', '')}  ${(statSync(f).size / 1024).toFixed(0)} KB`);
  } finally {
    await cleanup();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`capture-media failed: ${err?.stack ?? err}`);
    process.exit(1);
  },
);
