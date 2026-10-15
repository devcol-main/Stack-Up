# Task 001: Stack Up (웹 버전)

상태: 확정 (구현 시작 가능)
작성일: 2026-10-13
플랫폼: **웹 (TypeScript + Canvas 2D)**. Unity 아님. 저장소 `devcol-arcade-web`, 규칙은 `CLAUDE.md`

## 한 줄 요약
화면 위를 좌우로 오가는 블록을 탭(클릭/스페이스)해서 떨어뜨려 쌓는 원터치 게임. 아래 블록과 겹치지 않는 부분은 잘려 나가고, 블록이 완전히 빗나가면 게임 오버.

## 출발점
- 브라우저 시안 `docs/mockups/stack-up-neon.html`에 핵심 루프(이동, 자르기, Perfect, 콤보, 폭 회복, 속도, 카메라, 게임 오버)와 Neon 비주얼이 이미 동작함
- 시안 코드는 **참고용**. 자동 플레이(AI) 코드는 제거하고, 아래 구조로 다시 나눠서 작성

## 테마
- 블록 = 콜 스택 함수 프레임 (콘셉트만, **블록 안 글자 없음**)
- 게임 오버 화면에 작은 글씨로 "Stack collapsed"
- 게임 안의 모든 텍스트는 영어

## 비주얼: Neon
| 요소 | 값 |
|---|---|
| 배경 | 세로 그라디언트 `#07020F` → `#1D0634` |
| 바닥 그리드 | 원근 그리드, `#FF3CC8` 알파 25%, 카메라가 올라가면 화면 밖으로 |
| 블록 | 채움 해당 색 알파 16%, 밝은 외곽선 + 글로우 |
| 블록 색 순환 | `#FF33CC`, `#33DDFF`, `#A64DFF`, `#33FFAA`, `#FF8833` |
| 잘린 조각 | 블록과 같은 스타일, 알파 75%, 회전하며 낙하 |
| 점수 | 흰색 굵은 숫자 + `#FF3CC8` 글로우, 상단 중앙 |
| PERFECT | 흰 글자 + `#33E1FF` 글로우, 페이드아웃, 콤보는 `PERFECT ×3` |
| 로고 | 좌상단 `STACK UP`, `#FF7AD9` |
| 게임 오버 | 화면 어둡게, `GAME OVER` 핑크 글로우, 점수 시안 글로우, `BEST n` `#C9A8FF`, `Tap to retry` `#FF7AD9` |
| 폰트 | Geist 800 (OFL). 외부 CDN이 아니라 woff2 파일을 직접 포함 |

## 추가할 디테일 (시안에 없는 것)
- **움직이는 배경:** 천천히 흐르는 별/입자 레이어 2~3개(패럴랙스), 그리드가 은은하게 깜박임
- **VFX:** 블록 안착 시 외곽선 플래시, Perfect 시 링 파동 + 입자, 콤보 5 단위로 폭 회복 연출, 게임 오버 시 화면 흔들림(짧게)
- **사운드:** 안착, Perfect(콤보에 따라 음 높이 상승), 자르기, 게임 오버, 짧은 BGM 루프(선택). 음소거 토글, 설정은 localStorage에 저장
- `prefers-reduced-motion`이면 흔들림과 큰 입자 연출 축소

## 핵심 규칙
1. 첫 블록(베이스)은 고정, 폭 W0
2. 새 블록은 이전 블록과 같은 폭으로 생성되어 좌우로 왕복 이동
3. 입력 시 블록 정지. 겹친 구간만 남고 나머지는 잘려 떨어짐. 겹친 폭이 0 이하면 게임 오버
4. Perfect: 오차가 허용치 이내면 자르지 않고 스냅. Perfect 연속 N회마다 폭 회복 (최대 W0, 중심 기준)
5. 속도는 층수에 따라 증가 (상한 있음)
6. 카메라는 높이를 따라 위로 이동

## 점수
- 1층당 1점 + Perfect 보너스(콤보 수, 상한 5)
- 리더보드 값은 최종 점수 (보조: 층수, 최대 콤보)

## 초기 수치 (config.ts, 플레이하며 조정)
| 항목 | 초기값 |
|---|---|
| W0 | 화면 폭의 약 55% |
| Perfect 허용치 | 블록 폭의 약 3% (최소 하한) |
| 폭 회복 | Perfect 5연속마다 W0의 8% |
| 속도 | 시작 화면 폭 40%/초, 층당 +2.5%, 상한 120%/초 |
| 콤보 보너스 상한 | 5 |

## 조작과 화면
- 클릭, 탭, 스페이스. 연타 방지(게임 오버 직후 짧은 입력 무시)
- 흐름: 타이틀 → 플레이 → 게임 오버(점수, 최고 기록, 닉네임 입력, 리더보드 Top 10) → 재시작
- 사이트 iframe과 모바일 세로 화면에 맞게 크기 조정, 탭이 숨겨지면 일시정지
- 사운드는 첫 사용자 입력 이후에 시작 (브라우저 자동 재생 정책)

## 구조
```
games/stack-up/
  index.html
  src/core/      # 순수 로직 (DOM, Canvas, Audio 참조 금지) — StackUpLogic, config, rng(시드)
  src/view/      # Canvas 렌더링, 카메라, 배경, VFX, 글로우 스프라이트 캐시
  src/audio/     # WebAudio 효과음, 음소거
  src/ui/        # 타이틀, 게임 오버, 닉네임 입력, 리더보드 표시
  src/main.ts    # 게임 루프, 입력
  tests/         # Vitest
shared/leaderboard/  # LeaderboardService 인터페이스 + LocalLeaderboardService(localStorage)
```
- **글로우는 매 프레임 shadowBlur로 그리지 않고**, 시작할 때 오프스크린 캔버스에 색별 글로우 스프라이트를 미리 그려서 재사용 (모바일 성능)
- 리더보드 서버 연동은 이 Task 범위 밖. 인터페이스 + localStorage Mock만

## 하위 작업 순서 (권장)
1. 프로젝트 골격 (Vite, TypeScript, Vitest, 게임별 빌드 설정) + shared/leaderboard 인터페이스와 Mock + 테스트
2. core 로직 + 테스트
3. view: 블록, 카메라, 글로우 스프라이트, 바닥 그리드
4. 움직이는 배경, VFX
5. 오디오
6. UI 화면 흐름, 최고 기록, 리더보드 Mock 연결
7. 반응형, iframe 대응, 일시정지, reduced motion
8. 빌드 결과를 사이트로 복사하는 스크립트 (`docs/public/games/stack-up/`)

## 완료 조건
### 자동 검증
- [x] `npm run check` 통과 (타입체크 + Vitest)
- [x] core: 정확히 겹침 → 폭 유지, Perfect
- [x] core: 일부 겹침 → 겹친 폭만 남고 위치 갱신
- [x] core: 안 겹침 → 게임 오버, 이후 입력 무시
- [x] core: Perfect 허용치 경계값
- [x] core: Perfect N연속 폭 회복, W0 초과 안 함
- [x] core: 속도 증가와 상한
- [x] core: 점수 계산 (기본, 보너스, 콤보 상한)
- [x] core: 같은 시드면 같은 결과
- [x] leaderboard Mock: 저장, Top N 정렬, 동점, localStorage 사용 불가 시에도 오류 없이 동작
- [x] 빌드 용량: 사운드 제외 300KB 이하 (gzip 전 기준, 측정 후 조정) — 실측 88K (JS 33KB, 폰트 29KB, CSS 6KB)

### 수동 확인 (사람)
- [ ] PC 브라우저, iOS Safari, Android Chrome에서 60fps 근처
- [ ] 조작감: 탭 지연 없음, Perfect 판정이 억울하지 않음
- [ ] 사운드 볼륨 밸런스, 음소거 동작
- [ ] VitePress 페이지에 임베드해서 로컬(`npm run docs:dev`)로 확인

## 범위 밖
- 리더보드 서버(Cloudflare Worker) 연동, 로그인
- 모바일 앱 패키징
- 사이트 배포 (AdSense 승인 후)
