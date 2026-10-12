// 오디오 튜닝 수치. 모든 게인은 마스터 gain 이전 값(0~1).
export const AUDIO_CONFIG = {
  masterGain: 0.5,
  maxVoices: 10,
  storageKey: 'stackup.muted',

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
