import type { StackUpEvent } from '../core/StackUpLogic';
import { AUDIO_CONFIG as C } from './audioConfig';
import { cueForEvent, MuteStore, semitoneToFreq, stepToFreq, type SoundCue, type StorageLike } from './audioLogic';

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
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = 0;
  private muted: boolean;
  private readonly store: MuteStore;

  constructor(storage: StorageLike | null = getStorage()) {
    this.store = new MuteStore(storage);
    this.muted = this.store.load();
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
        master.gain.value = this.muted ? 0 : C.masterGain;
        master.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
        this.noise = this.makeNoise(ctx);
        // iOS: 입력 핸들러 안에서 무음 버퍼를 재생해 언락
        const b = ctx.createBuffer(1, 1, C.silentBufferRate);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      }
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
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
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : C.masterGain, this.ctx.currentTime, C.muteRamp);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** 탭 숨김 등. unlock 전이면 무시. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  resume(): void {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
  }

  /** core 이벤트 → 소리. unlock 전/음소거면 무시. 화살표 프로퍼티라 그대로 콜백으로 넘길 수 있다. */
  readonly onEvent = (ev: StackUpEvent): void => {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
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
      case 'gameOver':
        this.tone(C.gameOver.type, C.gameOver.freq, C.gameOver.endFreq, C.gameOver.dur, C.gameOver.gain, 0, C.gameOver.filterFreq);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0, lowpass = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.voices >= C.maxVoices) return;
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
    g.connect(this.master);
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
    if (!ctx || !this.master || !this.noise || this.voices >= C.maxVoices) return;
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
    g.connect(this.master);
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
