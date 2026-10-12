import type { StackUpEvent } from '../core/StackUpLogic';
import { AUDIO_CONFIG as C } from './audioConfig';
import {
  AudioSettingsStore,
  bgmStep,
  bgmStepDuration,
  canStartSfxVoice,
  cueForEvent,
  nextBgmTime,
  effectiveGains,
  clampVolume,
  MuteStore,
  semitoneToFreq,
  stepToFreq,
  type AudioSettings,
  type SoundCue,
  type StorageLike,
} from './audioLogic';

type AudioCtor = typeof AudioContext;

function getStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = 0;
  private muted: boolean;
  private readonly store: MuteStore;
  private readonly settingsStore: AudioSettingsStore;
  private settings: AudioSettings;
  private ducked = false;
  private readonly listeners = new Set<(s: Readonly<AudioSettings>) => void>();
  // BGM 스케줄러 상태
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmVoices = 0;
  private bgmStepIndex = 0;
  private bgmNextTime: number | null = null;
  private readonly bgmStepDur = bgmStepDuration();
  private readonly bgmTick = (): void => this.scheduleBgm();

  constructor(storage: StorageLike | null = getStorage()) {
    this.store = new MuteStore(storage);
    this.muted = this.store.load();
    this.settingsStore = new AudioSettingsStore(storage);
    this.settings = this.settingsStore.load();
  }

  /** 첫 사용자 입력 핸들러에서 호출. 이후 호출은 resume만 수행. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor: AudioCtor | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = C.masterGain;
        master.connect(ctx.destination);
        const bgmBus = ctx.createGain();
        const sfxBus = ctx.createGain();
        const g = effectiveGains(this.settings, this.muted, this.ducked ? C.duckFactor : 1);
        bgmBus.gain.value = g.bgm;
        sfxBus.gain.value = g.sfx;
        bgmBus.connect(master);
        sfxBus.connect(master);
        this.ctx = ctx;
        this.bgmBus = bgmBus;
        this.sfxBus = sfxBus;
        this.noise = this.makeNoise(ctx);
        // iOS: 입력 핸들러 안에서 무음 버퍼를 재생해 언락
        const b = ctx.createBuffer(1, 1, C.silentBufferRate);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      }
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
      this.syncBgm();
    } catch {
      // 오디오 사용 불가: 무음으로 진행
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.store.save(m);
    this.applyGains(C.muteRamp);
    this.syncBgm();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** 현재 설정의 사본. 옵션 UI는 이 값을 읽는다. */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setBgmOn(on: boolean): void {
    this.updateSettings({ ...this.settings, bgmOn: on });
  }

  setSfxOn(on: boolean): void {
    this.updateSettings({ ...this.settings, sfxOn: on });
  }

  setBgmVolume(v: number): void {
    this.updateSettings({ ...this.settings, bgmVolume: clampVolume(v, this.settings.bgmVolume) });
  }

  setSfxVolume(v: number): void {
    this.updateSettings({ ...this.settings, sfxVolume: clampVolume(v, this.settings.sfxVolume) });
  }

  /** 설정이 바뀔 때마다 호출. 반환 함수로 해제. */
  onSettingsChange(fn: (s: Readonly<AudioSettings>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** 게임 오버: BGM 볼륨을 낮춘다. onEvent의 gameOver에서도 자동 호출된다. */
  duck(): void {
    this.ducked = true;
    this.applyGains(C.duckRamp);
  }

  /** 재시작: BGM 볼륨 복귀. */
  unduck(): void {
    this.ducked = false;
    this.applyGains(C.duckRamp);
  }

  private updateSettings(next: AudioSettings): void {
    const a = this.settings;
    if (a.bgmOn === next.bgmOn && a.sfxOn === next.sfxOn && a.bgmVolume === next.bgmVolume && a.sfxVolume === next.sfxVolume) return;
    this.settings = next;
    this.settingsStore.save(next);
    this.applyGains(C.settingsRamp);
    this.syncBgm();
    for (const fn of this.listeners) {
      try {
        fn(this.settings);
      } catch {
        // 리스너 하나의 오류가 다른 리스너 통지를 막지 않게
      }
    }
  }

  private applyGains(ramp: number): void {
    if (!this.ctx || !this.bgmBus || !this.sfxBus) return;
    const g = effectiveGains(this.settings, this.muted, this.ducked ? C.duckFactor : 1);
    const t = this.ctx.currentTime;
    this.bgmBus.gain.setTargetAtTime(g.bgm, t, ramp);
    this.sfxBus.gain.setTargetAtTime(g.sfx, t, ramp);
  }

  /** 탭 숨김 등. unlock 전이면 무시. 스케줄러 타이머도 멈춘다. */
  suspend(): void {
    this.stopBgmTimer();
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  resume(): void {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
    this.syncBgm();
  }

  // ---- BGM: lookahead 스케줄러 (프레임 루프와 무관한 setInterval) ----

  /** BGM이 들려야 하는 상태면 타이머 시작, 아니면 정지. */
  private syncBgm(): void {
    const should = !!this.ctx && !this.muted && this.settings.bgmOn && !(typeof document !== 'undefined' && document.hidden);
    if (should) this.startBgmTimer();
    else this.stopBgmTimer();
  }

  private startBgmTimer(): void {
    if (this.bgmTimer !== null || !this.ctx) return;
    this.bgmNextTime = nextBgmTime(this.bgmNextTime, this.ctx.currentTime, C.bgm.startDelay);
    this.bgmTimer = setInterval(this.bgmTick, C.bgm.tickMs);
    this.scheduleBgm();
  }

  private stopBgmTimer(): void {
    if (this.bgmTimer === null) return;
    clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  private scheduleBgm(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return; // 정지 중에는 currentTime이 멈춰 있어 쌓이지 않는다
    const now = ctx.currentTime;
    let next = nextBgmTime(this.bgmNextTime, now, 0); // 이미 지난 경우에만 재정렬(따라잡지 않음)
    while (next < now + C.bgm.lookahead) {
      const st = bgmStep(this.bgmStepIndex);
      const t = next;
      if (st.arp !== null) this.bgmTone(C.bgm.arp, st.arp, t);
      if (st.bass !== null) this.bgmTone(C.bgm.bass, st.bass, t);
      if (st.hat) this.bgmHat(t);
      this.bgmStepIndex++;
      next += this.bgmStepDur;
    }
    this.bgmNextTime = next;
  }

  private bgmTone(p: { type: OscillatorType; gain: number; dur: number; filterFreq: number }, freq: number, t0: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmBus || this.bgmVoices >= C.bgm.maxVoices) return;
    const t1 = t0 + p.dur;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = p.type;
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = p.filterFreq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(p.gain, t0 + C.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.bgmBus);
    this.bgmVoices++;
    osc.onended = () => {
      this.bgmVoices--;
      osc.disconnect();
      filter.disconnect();
      g.disconnect();
    };
    osc.start(t0);
    osc.stop(t1 + C.stopMargin);
  }

  private bgmHat(t0: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmBus || !this.noise || this.bgmVoices >= C.bgm.maxVoices) return;
    const t1 = t0 + C.bgm.hat.dur;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = C.bgm.hat.filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(C.bgm.hat.gain, t0 + C.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.bgmBus);
    this.bgmVoices++;
    src.onended = () => {
      this.bgmVoices--;
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
    src.start(t0);
    src.stop(t1 + C.stopMargin);
  }

  /** core 이벤트 → 소리. unlock 전/음소거면 무시. 화살표 프로퍼티라 그대로 콜백으로 넘길 수 있다. */
  readonly onEvent = (ev: StackUpEvent): void => {
    if (ev.type === 'gameOver') this.duck();
    if (!this.ctx || this.muted || !this.settings.sfxOn || this.ctx.state !== 'running') return;
    const cue = cueForEvent(ev);
    if (cue) this.play(cue);
  };

  private play(cue: SoundCue): void {
    switch (cue.kind) {
      case 'land':
        this.tone(C.land.type, C.land.freq, C.land.endFreq, C.land.dur, C.land.gain);
        break;
      case 'perfect': {
        const f = stepToFreq(cue.step);
        this.tone(C.perfect.type, f, f, C.perfect.dur, C.perfect.gain);
        this.tone(C.harmonicType, f * 2, f * 2, C.perfect.dur * C.harmonicDurRatio, C.perfect.harmonicGain);
        break;
      }
      case 'cut':
        this.noiseBurst();
        break;
      case 'regrow':
        for (let i = 0; i < C.regrow.notes.length; i++) {
          const f = semitoneToFreq(C.regrow.baseFreq, C.regrow.notes[i]!);
          this.tone(C.regrow.type, f, f, C.regrow.dur, C.regrow.gain, C.regrow.delay + i * C.regrow.stepDelay);
        }
        break;
      case 'milestone': {
        const m = C.milestone;
        this.sweep(m.sweepFreq, m.sweepEndFreq, m.sweepDur, m.sweepGain);
        for (let i = 0; i < m.notes.length; i++) {
          const f = semitoneToFreq(m.baseFreq, m.notes[i]!);
          this.tone(m.type, f, f, m.dur, m.gain, i * m.stepDelay, 0, true);
        }
        break;
      }
      case 'gameOver':
        this.tone(C.gameOver.type, C.gameOver.freq, C.gameOver.endFreq, C.gameOver.dur, C.gameOver.gain, 0, C.gameOver.filterFreq);
        break;
    }
  }

  private sweep(f0: number, f1: number, dur: number, gain: number): void {
    this.tone(C.milestone.type, f0, f1, dur, gain, 0, 0, true);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0, lowpass = 0, milestone = false): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !canStartSfxVoice(this.voices, milestone)) return;
    const t0 = ctx.currentTime + delay;
    const t1 = t0 + dur;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + C.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    let tail: AudioNode = osc;
    let filter: BiquadFilterNode | null = null;
    if (lowpass > 0) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      osc.connect(filter);
      tail = filter;
    }
    tail.connect(g);
    g.connect(this.sfxBus);
    this.voices++;
    osc.onended = () => {
      this.voices--;
      osc.disconnect();
      filter?.disconnect();
      g.disconnect();
    };
    osc.start(t0);
    osc.stop(t1 + C.stopMargin);
  }

  private noiseBurst(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noise || !canStartSfxVoice(this.voices, false)) return;
    const t0 = ctx.currentTime;
    const t1 = t0 + C.cut.dur;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(C.cut.filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(C.cut.filterFreq * C.cutFilterEndRatio, t1);
    filter.Q.value = C.cut.filterQ;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(C.cut.gain, t0 + C.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    this.voices++;
    src.onended = () => {
      this.voices--;
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
    src.start(t0);
    src.stop(t1 + C.stopMargin);
  }

  /** 공유 노이즈 버퍼 (1회 생성, 고정 시드 LCG로 결정적). */
  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * C.noiseDur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = (s / 0xffffffff) * 2 - 1;
    }
    return buf;
  }
}
