// Stack Up view 튜닝 수치. 길이는 별도 표기가 없으면 "블록 높이(blockH)" 또는 비율.

export const VIEW_CONFIG = {
  /** devicePixelRatio 상한. */
  maxDpr: 2,
  /** 플레이 영역 최대 가로세로비 (폭/높이). 넓은 화면에서는 가운데 세로 띠만 쓴다. */
  maxAspect: 9 / 16,
  /** 블록 높이 = 플레이 폭 * 이 비율 (시안 22/270). */
  blockHeightRatio: 22 / 270,
  /** 베이스 블록 윗면 y = 화면 높이 - blockH * 이 값 (시안 70/22). */
  baseOffsetBlocks: 70 / 22,
  /** 카메라가 따라가기 시작하는 이동 블록 높이 (화면 높이 대비, 위에서부터). */
  followTopRatio: 0.45,
  /** 카메라 보간 속도 (1/초). */
  cameraRate: 5,

  /** 블록 세로 여백 (시안 2/22). 셀 안쪽으로 들어간 만큼 그린다. */
  blockInset: 2 / 22,
  /** 외곽선 두께 (blockH 비율, 시안 1.5/22). */
  strokeWidth: 1.5 / 22,
  /** 글로우 번짐 (blockH 비율). */
  glowBlur: 0.45,
  /** 스프라이트 바깥 여백 (blockH 비율). 글로우가 잘리지 않을 만큼. */
  glowPad: 0.7,
  /** 9-slice 모서리 안쪽 폭 (blockH 비율). */
  capInner: 0.6,

  fillAlpha: 0.16,
  pieceAlpha: 0.75,

  /** 외곽선을 글로우 색보다 얼마나 밝게(흰색 혼합 비율) 할지. */
  strokeLighten: 0.4,

  /** 조각 중력 (blockH/s^2, 시안 900px/22px). */
  pieceGravity: 900 / 22,
  /** 조각 풀 크기. 가득 차면 가장 많이 떨어진 조각을 재사용. */
  piecePoolSize: 24,
  /** 조각 회전 속도 (rad/s): 자르기 1~3 (방향은 side), 완전 빗나감 ±1.5. */
  pieceSpinMin: 1,
  pieceSpinRange: 2,
  dropSpin: 3,

  bgTop: '#07020F',
  bgBottom: '#1D0634',

  gridColor: 'rgba(255,60,200,0.25)', // #FF3CC8 알파 25%
  gridHorizontalLines: 8,
  gridCurve: 1.8,
  /** 소실점 쪽/바닥 쪽 세로선 간격 (플레이 폭 비율, 시안 14/270, 60/270). */
  gridSpacingTop: 14 / 270,
  gridSpacingBottom: 60 / 270,
} as const;

/** 블록 색 순환 (core의 colorIndex % 5). */
export const BLOCK_COLORS = ['#FF33CC', '#33DDFF', '#A64DFF', '#33FFAA', '#FF8833'] as const;
