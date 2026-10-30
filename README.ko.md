# Stack Up

[![CI](https://github.com/devcol-main/Stack-Up/actions/workflows/ci.yml/badge.svg)](https://github.com/devcol-main/Stack-Up/actions/workflows/ci.yml)

[English](README.md) · **한국어**

탭 한 번으로 즐기는 네온 블록 쌓기 게임입니다. 블록이 좌우로 움직이고, 탭하면 떨어집니다. 아래 탑 밖으로 삐져나온 부분은 잘려 나갑니다. 정확히 맞추면 Perfect, 연속으로 이어 가며 탑이 무너질 때까지 얼마나 높이 쌓을 수 있는지 겨뤄 보세요. TypeScript, Canvas 2D, WebAudio로 만들었습니다. 게임 엔진도, 외부 CDN도, 오디오 파일도 하나 없습니다. 효과음과 배경음악까지 모두 코드로 합성합니다.

<p align="center">
  <img src="docs/media/stack-up.gif" alt="Stack Up 플레이 영상: 네온 블록 쌓기, 잘려 나가는 조각, 폭이 회복되는 Perfect 콤보, 5층·10층 마일스톤, 탑을 따라 오르는 카메라, 게임 오버와 Top 10" width="300">
</p>

<sub>영상과 스크린샷은 봇이 고정 시드로 플레이한 장면입니다(`npm run media`). 화면에 보이는 연출은 실제 게임과 같고, 리더보드의 이름은 샘플 데이터입니다.</sub>

| 타이틀 | 플레이 | 게임 오버 | 옵션 |
|:---:|:---:|:---:|:---:|
| <img src="docs/media/title.png" alt="DevCol 로고가 있는 Stack Up 타이틀 화면" width="180"> | <img src="docs/media/gameplay.png" alt="12층 탑, PERFECT x7 팝업, 10 FLOORS 마일스톤, 사각형 충격파" width="180"> | <img src="docs/media/gameover.png" alt="점수, 닉네임 입력칸, Top 10이 있는 게임 오버 화면" width="180"> | <img src="docs/media/options.png" alt="BGM·SFX 토글과 볼륨 슬라이더가 있는 옵션 패널" width="180"> |

## 플레이 방법

| 입력 | 동작 |
|---|---|
| 화면 어디든 클릭 / 탭 | 블록을 떨어뜨립니다 (타이틀에서는 시작, 게임 오버에서는 다시 하기) |
| `Space` | 탭과 같습니다 (키를 꾹 눌러도 한 번만 인식) |
| `M` | 전체 음소거 / 해제 |
| `Esc` | 옵션 패널 닫기 |

Options 버튼을 누르면 BGM·SFX(켜기/끄기와 볼륨), Reduced motion, 최고 점수와 Top 10을 지우는 2단계 초기화를 설정할 수 있습니다. 패널이 열려 있는 동안에는 게임 입력이 무시됩니다.

### 규칙

- 탑 위에서 블록이 좌우로 움직입니다. 떨어뜨리면 아래 블록 위에 쌓입니다.
- 아래 블록 밖으로 삐져나온 부분은 잘려 떨어집니다. 어긋나게 쌓을 때마다 탑이 점점 좁아집니다.
- 아래 블록과 아주 조금만 어긋난 정도(허용치 안)면 **Perfect**입니다. 아무것도 잘리지 않고 폭 그대로 제자리에 붙습니다.
- **Perfect를 5번 연속**할 때마다 블록 폭이 시작 폭의 8%만큼 회복됩니다. 시작 폭(W0)까지만 늘어나고 그 이상은 넘지 않습니다.
- 탑에 아예 닿지 못하고 놓치면 게임이 끝납니다. 잘려 나간 판정이 한 번이라도 나오면 콤보가 초기화됩니다.
- 블록은 층마다 번갈아 반대편에서 나옵니다. 화면 밖으로 폭의 최대 90%까지 나갔다가 돌아옵니다.

### 점수

- 한 층마다 **1점**입니다.
- Perfect에는 현재 콤보만큼 보너스가 붙고, 보너스는 **5**에서 멈춥니다. Perfect 한 층의 점수는 1 + min(콤보, 5)라서 2, 3, 4, 5점을 거쳐 5연속부터는 매번 6점입니다.
- **5층, 이후 10층, 20층, 30층 …** 마일스톤마다 팝업(`N FLOORS!`), 효과음, 배경 플래시가 나옵니다. 점수는 따로 더해지지 않습니다.
- 최고 점수가 저장되고, Top 10에는 점수, 층수, 최고 콤보가 표시됩니다.

### 난이도 곡선

바뀌는 것은 속도뿐입니다. 속도 단위는 초당 플레이 영역 폭이고, 층이 오를수록 빨라집니다.

| | 값 |
|---|---|
| 시작 속도 (1층) | 0.4 |
| 층당 증가 | +0.025 |
| 상한 | 1.2 (33층에서 도달) |

Perfect 허용치는 블록 크기에 비례합니다. 현재 폭의 4.5%이고, 플레이 영역 폭의 0.006 밑으로는 내려가지 않습니다. 탑이 좁아질수록 절대적인 허용 범위도 줄다가 0.006에서 멈춥니다. 시작 블록 폭은 플레이 영역 폭의 55%입니다. 수치는 모두 [`src/core/config.ts`](src/core/config.ts)에 있습니다.

## 디자인 노트

### 네온

거의 검은 보라색 배경이 위에서 아래로 짙은 보라로 번지고, 희미하게 깜박이는 원근 그리드가 깔립니다. 별은 세 겹이고, 카메라가 올라갈 때 시차를 두고 움직입니다. 블록은 반투명에 밝은 외곽선과 글로우가 있고, 다섯 가지 네온 색(마젠타, 시안, 보라, 민트, 주황)을 돌아가며 씁니다. 글로우는 매 프레임 블러로 그리지 않고 미리 만들어 둔 스프라이트를 씁니다.

### 떨어뜨리는 손맛

- 잘린 조각은 중력과 회전을 받으며 떨어집니다. 조각은 고정 크기 풀에서 재사용합니다.
- **Perfect**는 블록 둘레에 사각형 충격파와 입자를 터뜨립니다. 콤보가 높을수록 커지고, 콤보 3부터는 충격파가 시안색이 됩니다.
- Perfect 효과음은 콤보가 쌓일수록 장조 5음 음계를 타고 올라가서, 연속 성공이 소리로 들립니다.
- 폭이 회복되면 흰 외곽선이 이전 폭에서 새 폭으로 늘어나고 상승 아르페지오가 울립니다.
- 마일스톤에서는 배경이 마젠타와 시안으로 번갈아 번쩍이고 짧은 팡파르가 나옵니다.
- 게임 오버에서는 화면이 잠깐 흔들리고, 놓친 블록이 떨어지며 `GAME OVER`와 `Stack collapsed`가 나옵니다. 마지막에 정신없이 누른 탭이 결과 화면을 넘기지 않도록 게임 오버 직후 0.3초 동안 입력을 막습니다.

### 오디오

모두 WebAudio로 합성합니다. 108 BPM, A 마이너 펜타토닉 아르페지오에 톱니파 베이스와 하이햇을 얹었고, 착지·절단·Perfect·폭 회복·마일스톤·게임 오버 효과음이 있습니다. BGM과 SFX는 켜기/끄기와 볼륨이 따로이며, 게임 오버 중에는 음악이 작아집니다.

### 접근성과 안정성

- **Reduced motion**(OS 설정 또는 옵션 패널)을 켜면 화면 흔들림이 없어지고, 입자와 충격파가 작아지며, 별의 흐름이 느려지고, 그리드 깜박임과 마일스톤 플래시가 순해집니다.
- 탭이 숨겨지면 게임이 일시정지되고 돌아오면 이어집니다. 창이나 iframe 크기가 바뀌어도 맞춰 조정되고, 세로 폰 화면도 지원합니다.
- 플레이 영역은 가로세로비 9:16까지만 쓰므로, 넓은 화면에서는 가운데 세로 띠만 사용합니다.

## 기술 노트

### 구조

```
src/
  core/     순수 게임 로직: DOM, Canvas, Audio, 저장소 참조 없음
  view/     Canvas 렌더링, 카메라, 배경, VFX, 글로우 스프라이트 캐시
  audio/    WebAudio 합성, BGM 스케줄러, 오디오 설정
  ui/       화면 흐름, HTML 오버레이, 옵션, 기록
  shared/   리더보드와 플레이어 프로필 (다른 DevCol 게임과 공유하는 형식)
  main.ts   게임 루프와 입력
tests/      Vitest
```

### 결정적인 core

`core/`는 화면이 있는지조차 모릅니다. `StackUpLogic`은 `update(dt)`와 `drop()`을 받아 이벤트 목록(착지, Perfect, 절단, 폭 회복, 마일스톤, 게임 오버)을 내놓습니다. 난수는 주입받은 시드 기반 생성기에서 나오므로 같은 시드와 같은 입력이면 항상 같은 게임이 됩니다. `npm run media`가 매번 같은 플레이를 재현할 수 있는 이유입니다. view, 오디오, HUD가 모두 같은 이벤트 목록에 반응합니다.

### 렌더링

- **매 프레임 `shadowBlur`를 쓰지 않습니다.** 글로우가 있는 블록은 크기가 바뀔 때 오프스크린 캔버스에 9-slice 스프라이트로 한 번 그려 두고 `drawImage`로 복사합니다.
- **풀링.** 입자, 충격파, 플래시, 떨어지는 조각은 고정 크기 풀을 씁니다.
- **devicePixelRatio**는 2로 제한합니다.

### 오디오

소리는 모두 실행 중에 WebAudio로 만들며 오디오 파일은 없습니다. AudioContext는 첫 사용자 입력에서 resume하고(브라우저 자동재생 정책), 동시 보이스 수를 제한해서 한 번에 소리가 몰려도 깨지지 않게 합니다.

### 저장소와 리더보드

모든 데이터는 `try/catch`로 감싼 `localStorage`에 저장하므로, 저장소가 막힌 환경에서도 게임은 돌아갑니다.

| 키 | 내용 |
|---|---|
| `stackup.best` | 최고 점수 |
| `stackup.leaderboard` | 로컬 Top 10 |
| `stackup.muted` | 음소거 상태 |
| `stackup.audio` | BGM/SFX 켜기와 볼륨 |
| `stackup.reducedMotion` | 수동 Reduced motion 설정 |
| `devcol.player.id`, `devcol.player.nickname` | 공통 플레이어 프로필 |
| `devcol.player.token`, `devcol.player.lbEntries` | 온라인 리더보드 소유 토큰과 내 항목 id (공유) |

devcol.net에서는 Top 10을 공용 온라인 리더보드(`a.devcol.net/lb`, 서버는 [devcol-analytics](https://github.com/devcol-main/devcol-analytics))에서 가져옵니다. 로그인은 없고, 첫 제출 때 받은 랜덤 토큰으로 내 온라인 기록을 지울 수 있습니다(Options → Online scores → Delete mine). 플레이어 ID는 보내지 않습니다. 닉네임은 서버가 검사하고, 부적절한 이름은 `Player####`로 보입니다. 모든 점수는 로컬에도 저장되며, 서버에 닿지 못하면 "Offline" 안내와 함께 로컬 순위를 보여 줍니다. devcol.net 밖(로컬 dev)에서는 로컬 전용이고, `npm run dev`에 `?lb=http://localhost:8787/lb`를 붙이면 로컬 Worker에 연결합니다.

리더보드는 `LeaderboardService` 인터페이스 뒤에 있습니다(`OnlineLeaderboardService`가 `LocalLeaderboardService`를 감쌈). [`src/shared/`](src/shared/)의 플레이어 프로필(ID 하나와 닉네임)은 같은 도메인에서 서비스하면 [Bug Squash](https://github.com/devcol-main/Bug-Squash)와 런타임에 공유되므로, 형식을 그 저장소와 맞춰 두어야 합니다. 옛 `stackup.nickname` 키는 이전용으로 한 번 읽기만 하고 다시 쓰지 않습니다.

### 용량

프로덕션 빌드는 폰트와 로고를 포함해 **124 KB**입니다(오디오 파일 없음). CI에서 300 KB 한도로 검사합니다.

### 스크린샷과 GIF

[`scripts/capture-media.mjs`](scripts/capture-media.mjs)(`npm run media`)가 헤드리스 Chrome에서 봇으로 고정 시드 플레이를 돌려 스크린샷과 GIF를 `docs/media/`에 만듭니다. 화면이 바뀌면 다시 실행하세요.

## 시작하기

Node.js 24가 필요합니다([`.nvmrc`](.nvmrc) 참고).

```bash
npm ci
npm run dev      # http://localhost:5173
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run check` | `tsc --noEmit` + Vitest |
| `npm test` | Vitest만 실행 |
| `npm run build` | `dist/`에 프로덕션 빌드 (상대 경로, CDN 없음) |
| `npm run media` | `docs/media` 재생성 (Google Chrome과 `ffmpeg` 필요) |

빌드한 뒤에는 `bash scripts/verify-build.sh`로 번들을 점검합니다(용량 한도 300 KB, 번들에 개발 전용 훅이 없는지 확인).

사이트에 넣으려면 다음과 같이 합니다.

```bash
npm run build
bash scripts/copy-to-site.sh
```

`dist/`가 `../devcol-site/devcol-build/docs/public/games/stack-up/`로 복사됩니다.

## 개발 방식

명세를 먼저 쓰는 방식으로 개발했습니다([`CLAUDE.md`](CLAUDE.md) 참고).

- 모든 변경은 체크리스트가 있는 명세([`docs/tasks/`](docs/tasks/))에서 시작합니다. 분리 전에 쓴 명세는 예전 모노레포 경로를 가리킵니다.
- 작업은 하위 작업(core와 테스트, 렌더링, 연출과 오디오, UI, 마무리)으로 나눕니다. 구현 에이전트가 코드를 쓰고, 테스트 에이전트가 `npm run check`를 돌리고, 리뷰 에이전트가 diff를 검토합니다. 반복 한도가 엄격하며, 모든 하위 작업은 실수까지 포함해 [`docs/pipeline-log.md`](docs/pipeline-log.md)에 기록합니다.
- 테스트로 확인할 수 없는 것(조작감, 소리 균형, 실기기)은 작업이 끝날 때마다 사람이 볼 항목으로 따로 남깁니다.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml)이 `main`으로의 PR과 push에서 `npm ci`, `npm run check`, `npm run build`, `scripts/verify-build.sh`를 실행합니다.

## 관련 저장소

- [devcol-main/Arcade-Web](https://github.com/devcol-main/Arcade-Web): Stack Up이 분리되어 나온 저장소입니다. 히스토리를 보존했습니다.
- [devcol-main/Bug-Squash](https://github.com/devcol-main/Bug-Squash): 같은 DevCol의 브라우저 게임입니다. 플레이어 프로필 형식을 공유합니다.

## 라이선스

- 코드: [Apache License 2.0](LICENSE). [`NOTICE`](NOTICE)를 참고하세요.
- 폰트: Geist, SIL Open Font License 1.1. 라이선스 문서와 함께 `public/licenses/`에 포함되어 있습니다.
- DevCol 로고(`src/assets/`): DevCol 소유이며 Apache-2.0으로 재사용을 허가하지 않습니다([`docs/assets.md`](docs/assets.md) 참고).
- 오디오 파일은 없습니다. 모든 소리를 코드로 합성합니다.
- `docs/media/`의 스크린샷과 GIF는 이 게임을 캡처한 것입니다.
