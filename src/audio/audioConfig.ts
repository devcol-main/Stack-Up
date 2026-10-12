// 오디오 튜닝 수치. 모든 게인은 마스터 gain 이전 값(0~1).
export const AUDIO_CONFIG = {
  masterGain: 0.5,
  /** SFX 동시 보이스 상한. 한 drop 최대 = cut1 + perfect2 + regrow4 + milestone5 = 12 → 여유 2. */
  maxVoices: 14,
  /** 마일스톤 전용 예약분: 다른 SFX는 maxVoices - 이 값까지만 쓴다(일반 최대 7~8 ≤ 9). */
  milestoneVoiceReserve: 5,
  storageKey: 'stackup.muted',
  settingsKey: 'stackup.audio',

  /** 기본 설정. BGM은 SFX보다 낮게. */
  defaults: { bgmOn: true, sfxOn: true, bgmVolume: 0.35, sfxVolume: 0.8 },
  /** 설정 변경/덕킹 시 gain 램프 시간 상수(초). */
  settingsRamp: 0.03,
  duckRamp: 0.25,
  /** 게임 오버 중 BGM 배율. */
  duckFactor: 0.25,

  /** 마일스톤: 짧은 상승 팡파르 (반음 오프셋 + 위로 쓸어올리는 스윕). */
  milestone: {
    notes: [0, 7, 12, 19],
    baseFreq: 784, // G5
    stepDelay: 0.06,
    dur: 0.22,
    gain: 0.14,
    type: 'triangle' as OscillatorType,
    sweepFreq: 400,
    sweepEndFreq: 1600,
    sweepDur: 0.3,
    sweepGain: 0.08,
  },

  /** BGM: 8분음표 스텝 시퀀서. A 마이너 펜타토닉. */
  bgm: {
    bpm: 108,
    stepsPerBar: 8, // 8분음표
    stepsPerBeat: 2,
    bassSteps: [0, 4, 6], // 마디 안 베이스 스텝
    bars: 4,
    baseFreq: 220, // A3 (아르페지오 기준음)
    scaleSemitones: [0, 3, 5, 7, 10], // 마이너 펜타토닉
    /** 한 마디(8스텝)의 아르페지오: 음계 인덱스(옥타브 이어붙임), null=쉼. */
    arpPattern: [0, 2, 4, 2, 5, 4, 2, 3],
    /** 마디별 아르페지오 이조(음계 인덱스 오프셋). */
    barShift: [0, 0, 1, -1],
    /** 마디별 베이스 근음(A 기준 반음). A, A, C, G. */
    bassRoots: [0, 0, 3, -2],
    bassBaseFreq: 55, // A1
    /** 하이햇이 나오는 스텝(마디 안 인덱스): 오프비트. */
    hatSteps: [1, 3, 5, 7],
    lookahead: 0.3, // 몇 초 앞까지 예약
    tickMs: 80,
    maxVoices: 8,
    startDelay: 0.08,
    arp: { type: 'square' as OscillatorType, gain: 0.07, dur: 0.2, filterFreq: 2200 },
    bass: { type: 'sawtooth' as OscillatorType, gain: 0.16, dur: 0.24, filterFreq: 420 },
    hat: { gain: 0.04, dur: 0.05, filterFreq: 7000 },
  },

  /** Perfect 음계: 장조 5음 음계(반음 오프셋). 스텝이 올라갈수록 위 옥타브로 이어진다. */
  scaleSemitones: [0, 2, 4, 7, 9],
  perfectBaseFreq: 523.25, // C5
  /** 콤보 1 = 스텝 0. 이 스텝에서 더 오르지 않는다 (C5 ~ 약 3옥타브 안쪽). */
  perfectMaxStep: 9,

  land: { freq: 180, endFreq: 90, dur: 0.12, gain: 0.35, type: 'sine' as OscillatorType },
  perfect: { dur: 0.28, gain: 0.3, harmonicGain: 0.12, type: 'triangle' as OscillatorType },
  cut: { dur: 0.16, gain: 0.18, filterFreq: 1800, filterQ: 0.8 },
  regrow: {
    notes: [0, 4, 7, 12], // 반음 오프셋 (아르페지오)
    baseFreq: 659.25, // E5
    stepDelay: 0.07,
    delay: 0.12, // Perfect 음과 겹치지 않게 약간 뒤에서 시작
    dur: 0.18,
    gain: 0.16,
    type: 'sine' as OscillatorType,
  },
  gameOver: {
    freq: 392,
    endFreq: 98,
    dur: 0.7,
    gain: 0.3,
    type: 'sawtooth' as OscillatorType,
    filterFreq: 1200,
  },
  /** 엔벨로프 어택/최소 게인 (클릭 노이즈 방지). */
  attack: 0.005,
  muteRamp: 0.01,
  stopMargin: 0.02,
  noiseDur: 0.3,
  silentBufferRate: 22050,
  harmonicType: 'sine' as OscillatorType,
  harmonicDurRatio: 0.8,
  cutFilterEndRatio: 0.4,
} as const;
