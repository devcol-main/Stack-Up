# Stack Up 사이트 업로드 가이드 (devcol-site 세션용)

이 문서만 보고 Stack Up을 devcol.net(VitePress, 사이트 리포 `devcol-site/devcol-build`)에 올릴 수 있도록 쓴 문서다.
작성 기준일 2026-10-15. 사이트 쪽 사실은 그날 사이트 리포를 읽어서 확인한 것이고, 확인하지 못한 것은 **확인 필요**로 표시했다.

## 1. 개요

- Stack Up: 좌우로 움직이는 블록을 타이밍에 맞춰 떨어뜨려 탑을 쌓는 웹 아케이드 게임. 모바일 세로 화면 기준, Canvas 2D + WebAudio(합성 사운드), 외부 의존성 없음.
- 리포: https://github.com/devcol-main/Stack-Up (공개)
- 라이선스: 코드 Apache-2.0(`LICENSE`), 글꼴 Geist는 SIL OFL 1.1, DevCol 로고는 DevCol 소유(Apache-2.0 대상 아님). 자세한 내용은 5절.
- 이 문서의 범위는 "사이트에 올리는 방법"까지다. 게임 동작 변경은 이 리포(Stack-Up)에서 한다.

## 2. 빌드와 복사

Stack-Up 리포에서. `copy-to-site.sh`는 Stack-Up과 devcol-site가 **같은 상위 폴더의 형제 폴더**이고 사이트 리포가 `<상위>/devcol-site/devcol-build`에 있다고 가정한다.

```bash
cd <Stack-Up 리포 경로>
npm ci && npm run build && bash scripts/verify-build.sh && bash scripts/copy-to-site.sh
```

- `scripts/verify-build.sh`: `dist` 용량 300KB 한도와 개발 전용 훅 `__stackUp`이 번들에 없는지 검사한다. 실패하면 복사하지 말 것.
- `scripts/copy-to-site.sh`: `dist/`를 `../devcol-site/devcol-build/docs/public/games/stack-up`으로 복사한다. 대상 폴더는 **먼저 `rm -rf`로 지우고** 다시 만든다(옛 해시 파일이 남지 않게). 단 사이트 리포의 `docs` 폴더(`../devcol-site/devcol-build/docs`)가 없으면 아무것도 지우거나 만들지 않고 오류로 종료한다. 현재 사이트 리포에는 `docs/public/games/` 폴더가 아직 없고 스크립트가 `mkdir -p`로 만든다.
- 사이트에서는 `docs/public/`의 파일이 그대로 루트 경로로 서비스되므로 게임 주소는 `/games/stack-up/index.html`이다. 사이트는 `cleanUrls: true`이지만 `public/` 안의 정적 파일에는 영향이 없으니 `index.html`까지 명시해서 링크한다.

### 산출물 (2026-10-15 실제 빌드, `dist` 합계 124KB)

| 파일 | 크기(바이트) |
|---|---|
| `index.html` | 4,174 |
| `assets/index-BkpBTErM.js` | 48,580 |
| `assets/index-BL1BDdsB.css` | 10,465 |
| `assets/geist-latin-wght-normal-BgDaEnEv.woff2` | 29,400 |
| `assets/devcol-logo-COrzzs1X.png` | 6,129 |
| `assets/devcol-logo-dark-Dbfvftzb.png` | 6,284 |
| `licenses/Geist-OFL-LICENSE.txt` | 4,486 |

해시 부분은 빌드마다 바뀔 수 있다. 위 목록은 구조를 보여주는 용도다.

- 상대 경로(`vite.config.ts`의 `base: './'`): `dist/index.html`의 JS/CSS/아이콘 참조가 모두 `./assets/...`라서 `/games/stack-up/` 같은 하위 경로에서 그대로 동작한다. 절대 경로(`/assets/...`)는 쓰지 않는다.
- 외부 CDN 없음: 빌드된 `index.html`, JS, CSS에 `http(s)://` 문자열이 하나도 없다. 폰트와 이미지, 소리(전부 WebAudio 합성, 오디오 파일 없음)가 모두 `dist` 안에 있다.
- `licenses/Geist-OFL-LICENSE.txt`는 `public/licenses/`에서 빌드 때 `dist/licenses/`로 복사된다. 복사 시 이 파일을 **빼지 말 것**.
- 서버가 정적 파일만 주면 된다. 서버 쪽 설정(헤더, 리라이트)은 필요 없다.

## 3. VitePress 임베드

### 사이트의 기존 관례 (사이트 리포에서 확인)

- 사이트 페이지와 프로젝트 글은 **영어**다(`docs/projects/*.md`). 게임 페이지도 영어로 써야 한다. 6절의 영어 초안을 본문으로 다듬어 쓰고, 한국어 초안은 참고용이다.
- 기존 게임 임베드는 `docs/projects/press-plane.md`, `rock-paper-scissors-advance.md`의 itch.io iframe뿐이다. 형식은 다음과 같다. 자체 호스팅 게임(`/games/...`) 임베드는 아직 사이트에 없다.

  ```html
  ## Play in browser

  <div style="max-width: 400px;">
  <iframe src="https://itch.io/embed-upload/15989559?color=333333" width="100%" height="600" frameborder="0" allowfullscreen></iframe>
  </div>
  ```
- 프로젝트 글은 `docs/projects/<slug>.md`(frontmatter `title`, `outline: deep`)에 쓰고, 목록 카드는 `docs/.vitepress/theme/projects.ts`의 `groups`(항목: `title`, `href`, `blurb`, `tags`, `img`/`video`/`poster`), 사이드바는 `docs/.vitepress/config.mts`의 `sidebar['/projects/']`에 있다. 새 페이지를 만들면 이 둘에도 등록해야 하는지 확인할 것. 어느 그룹에 넣을지(예: Unity 그룹이 아닌 새 "Web Games" 그룹)는 **확인 필요**(사용자 결정).
- Bug Squash는 사이트에 아직 임베드되어 있지 않다(`grep`으로 `games/`, `Bug Squash` 없음 확인). 따라서 맞출 선행 사례가 없다.

### iframe 예시

```html
<div style="max-width: 400px; margin: 0 auto;">
<iframe
  src="/games/stack-up/index.html"
  title="Stack Up - a one-button tower stacking game"
  loading="lazy"
  style="width: 100%; aspect-ratio: 9 / 16; border: 0; display: block;"
></iframe>
</div>
```

- `title`: 접근성용으로 꼭 넣는다.
- `loading="lazy"`: 글 중간이나 아래쪽에 두면 스크롤해서 가까워질 때 로드된다. 페이지 최상단에 두는 경우 `lazy`를 빼도 된다.
- 크기: 게임은 가로 폭을 `min(폭, 높이 * 9/16)`인 **9:16 세로 열**을 가운데에 그리고(`src/view/layout.ts`, `viewConfig.maxAspect = 9/16`), 그보다 넓으면 양옆에 배경(별과 그라디언트)만 그린다. 그래서 iframe이 넓어도 깨지지 않지만 플레이 열은 높이에 비례해 정해진다.
  - 권장: 사이트 관례(`max-width: 400px` div로 감싸기)대로 감싸는 div를 `max-width: 400px; margin: 0 auto`로 두고, iframe은 `height` 속성 없이 `width: 100%; aspect-ratio: 9 / 16`으로 비율을 정한다. 400px 폭이면 높이는 약 711px, 폭이 좁은 모바일에서는 폭에 비례해 줄어든다(360px이면 640px). `height` 속성을 같이 주면 `aspect-ratio`가 무시되므로 넣지 않는다.
  - `aspect-ratio`를 지원하지 않는 구형 브라우저용 대안: `aspect-ratio` 대신 `height: 711px`처럼 고정 높이를 준다(반응형 비율은 포기).
  - 사이트 CSS에서의 최종 모양은 로컬에서 확인할 것(**확인 필요**).
- `allow` 속성: **필요 없다.** 오디오는 첫 사용자 입력(`pointerdown`/`keydown`)에서 `AudioContext`를 만들고 resume하므로(`src/main.ts`, `src/audio/AudioManager.ts`의 `unlock()`) autoplay 권한이 필요 없다. 마이크, 카메라, 전체 화면 등도 쓰지 않는다. `sandbox`를 붙일 경우 `allow-scripts allow-same-origin`이 최소한 필요하다(localStorage 때문). 굳이 붙이지 않는 것을 권장.
- 같은 출처(`devcol.net`)에서 서비스되므로 `X-Frame-Options` 같은 헤더 문제는 없을 것으로 보이나 **확인 필요**(호스팅이 GitHub Pages라는 점은 CLAUDE.md 기준이고, 헤더는 직접 확인하지 못함).

### iframe 안 동작 (코드에서 확인)

- 키보드 포커스: iframe은 클릭하기 전에는 키보드 입력을 받지 못한다. 게임은 첫 포인터 입력에서 `window.focus()`와 캔버스 `focus()`를 호출하므로(`grabFocus`), **첫 클릭/탭 이후에는 Space로도 블록을 떨어뜨릴 수 있다.** 첫 입력(Tap to start)은 클릭이어야 한다. 페이지에 "Click the game once, then press Space" 같은 안내를 두면 좋다.
- 입력: 탭/클릭/Space로 드롭, `M` 키로 음소거(닉네임 입력 중에는 무시), 옵션 패널은 `Esc`로 닫힘.
- 스크롤: 캔버스에 `touch-action: none`, 문서에 `overscroll-behavior: none`이 걸려 있어 iframe 위에서 터치 드래그가 페이지 스크롤로 넘어가지 않는다. 모바일에서 게임 상자 위에서 스크롤이 막히는 느낌이 들 수 있으니 상자 위아래에 여백을 두는 것이 좋다(**확인 필요**: 실기기).
- 탭 숨김 시 일시정지: `visibilitychange`, `pagehide`, `pageshow`에서 게임 시계를 멈추고(dt = 0) 오디오를 suspend한다. 탭을 돌아오면 이어서 재생된다.
- 리사이즈: `window resize`, `visualViewport resize`, 캔버스 `ResizeObserver`를 모두 받아 프레임당 한 번 처리한다. iframe 크기가 바뀌어도(반응형 레이아웃) 자동으로 다시 그린다. `devicePixelRatio`는 상한 2.
- iOS 주소창 변화에 맞춰 캔버스는 `position: fixed; inset: 0`으로 실제 보이는 영역을 따른다.

## 4. localStorage 키

모두 `localStorage`이고 접근은 항상 try/catch다(사용 불가 환경에서도 게임은 동작하고 기록만 메모리에 남음). 같은 도메인(`devcol.net`)에서 Bug Squash도 같은 공유 키를 쓴다. 두 게임의 코드(`src/shared/player/PlayerProfile.ts`)를 대조해 확인했다.

| 키 | 용도 | 공유 여부 |
|---|---|---|
| `devcol.player.id` | 익명 플레이어 ID(랜덤 생성) | 공유(Stack Up과 Bug Squash가 같은 값 사용) |
| `devcol.player.nickname` | 플레이어 닉네임(최대 12자, 비면 `Anonymous`) | 공유 |
| `stackup.nickname` | 옛 닉네임 키. 공통 닉네임이 없을 때 한 번 **읽어서 가져오기만** 하고 쓰지 않음 | Stack Up 전용(레거시, 읽기 전용). Bug Squash 쪽은 `bugSquash.nickname`을 같은 방식으로 가져옴 |
| `stackup.best` | 최고 점수 | Stack Up 전용 |
| `stackup.leaderboard` | 로컬 Top 리스트(최대 50개 저장, 화면엔 Top 10). 서버 전송 없음, 브라우저별 기록 | Stack Up 전용 |
| `stackup.reducedMotion` | 수동 Reduced motion 설정(`'1'`/`'0'`) | Stack Up 전용 |
| `stackup.muted` | 전체 음소거 상태 | Stack Up 전용 |
| `stackup.audio` | BGM/SFX 켜기와 볼륨 설정(JSON) | Stack Up 전용 |

- Bug Squash 전용 키(참고, 같은 도메인에 공존): `bugSquash.best`, `bugSquash.leaderboard`, `bugSquash.reducedMotion`, `bugSquash.vibration`, `bugSquash.audio.muted`, `bugSquash.audio.settings`, 레거시 `bugSquash.nickname` (출처: Bug-Squash 리포 `src/ui/uiConfig.ts`, `src/audio/audioConfig.ts`).
- 게임 옵션의 "Reset data"는 `stackup.best`와 `stackup.leaderboard`만 지운다. `devcol.player.*`와 다른 게임 기록은 건드리지 않는다(`src/ui/options.ts`의 `resetUserData`).
- **공유 키 형식은 바꾸지 않는다.** 바꿔야 하면 두 리포(Stack-Up, Bug-Squash)의 `src/shared`를 같이 맞춘다.
- 사이트 쪽에서 쿠키/저장소 안내(Privacy Policy)에 게임이 브라우저에 저장하는 값이 있다는 내용을 넣을지는 **확인 필요**(사이트 세션과 사용자 판단). 게임은 개인정보를 서버로 보내지 않는다(리더보드는 로컬 전용).

## 5. 라이선스와 표기 의무

- 코드: Apache-2.0 (`LICENSE`, `NOTICE`). 사이트에 올릴 때 추가 표기는 필수는 아니다.
- 글꼴 Geist(SIL OFL 1.1, Copyright 2024 The Geist Project Authors): 번들된 폰트와 함께 `licenses/Geist-OFL-LICENSE.txt`를 **반드시 같이 배포**한다. `copy-to-site.sh`가 `dist` 전체를 복사하므로 그대로 두면 된다. 사이트 라이선스/크레딧 페이지가 있다면 거기에 Geist 표기를 더하는 것은 선택이다.
- DevCol 로고(`devcol-logo.png`, `devcol-logo-dark.png`): DevCol 소유. Apache-2.0 라이선스 대상이 아니다. 사이트 소유자가 올리는 것이므로 문제는 없지만 다른 용도로 재사용하지 말 것.
- 오디오: 오디오 파일이 없다. 효과음과 BGM은 모두 WebAudio로 합성한다(`src/audio/`). 따라서 사운드 라이선스 표기 의무가 없다.
- 에셋 기록: `docs/assets.md`.

## 6. 게임 페이지 글 재료

> 주의 1: 사이트 페이지는 영어이므로 **영어 초안을 본문 재료로** 쓰고, 한국어 초안은 참고용으로 그 아래에 남겼다. 둘 다 **출발점**이다. 사이트 세션에서 사이트 톤에 맞게 다듬을 것.
> 주의 2: 사이트 이력(`devcol-site/DEVCOL_HISTORY.md`)에 따르면 2026-09-23에 AdSense를 신청했고, 10/4에 "가치가 낮은 콘텐츠(Low value content)"로 반려된 화면이 확인되었으며, 이후 얇은 페이지를 보강하는 작업을 해왔다(재신청 여부는 기록에 없음). 이 경험상 **게임 임베드만 있는 얇은 페이지보다, 직접 쓴 설명 글이 함께 있는 페이지**가 필요하다. 그래서 아래처럼 소개, 규칙, 팁, 개발 노트를 글로 함께 싣는다. AdSense 정책 자체에 대한 다른 주장은 이 문서에서 확인한 것이 없다.

### English draft (for the site page)

#### Intro

Stack Up is a one-button tower stacking game. A block slides back and forth across the screen, and you tap to drop it onto the tower. Only the part that overlaps the block below stays. Anything that hangs over is cut off, so the tower gets narrower and the blocks get faster as you climb. If you line a block up almost exactly, that's a Perfect: it scores more, and a streak of them slowly gives the lost width back. If a block misses the tower entirely, the run ends. Your best score and a local Top 10 are saved in your browser.

#### How to play

- Tap, click, or press Space to start and to drop a block. Click the game once before using the keyboard, because the keys only work after the game has focus.
- Press M or use the Sound button to mute. The Options panel has BGM and SFX switches with volume sliders, a Reduced motion setting, and a button that resets your best score and Top 10.
- After a game over you can type a nickname and press Submit to add your score to the Top 10 stored in this browser. Tap to play again.

#### Scoring rules

- Every block you stack is worth 1 point.
- A Perfect is worth 1 point plus a combo bonus equal to your current Perfect streak, capped at +5. The first Perfect in a row gives 2 points, and the fifth or later gives 6.
- A drop counts as Perfect when the block is within 4.5% of its own width of the block below (never less than 0.6% of the play-area width). A Perfect block snaps exactly onto the tower.
- Every 5 Perfects in a row, the block gets 8% of the starting width back, and it never grows past the starting width (55% of the play-area width).
- Any cut resets the streak to 0.
- Milestone effects play at 5 floors, at 10, and then every 10 floors (20, 30, and so on).
- Blocks start at 0.4 play-area widths per second and get 0.025 faster each floor, up to a cap of 1.2. The cap is reached at about floor 33. The starting side is random, and after that the blocks alternate left and right.

#### Tips

1. Go for Perfects while the blocks are still slow. Every 5 in a row restores width, so an early streak decides how wide your tower is later.
2. The speed is constant within a floor, and the side alternates. Watch a pass or two to learn the rhythm, then tap.
3. When the tower is thin, aim to overlap rather than to be perfect. A big cut makes every following block smaller too, so avoiding one large mistake matters more than one more Perfect.
4. Past about floor 33 the speed stops rising. From there it's all about staying focused.
5. Perfects play a note from a major pentatonic scale starting at C5, and each Perfect in a streak goes one step higher, up to the tenth note (A6, just under two octaves up). With the sound on you can hear that a streak is alive without looking at the score.

#### Dev notes

- All the sound is synthesized with WebAudio oscillators and noise, including the sound effects and the step-sequenced background music (A minor pentatonic, 108 BPM). There are no audio files, which is part of why the whole build is 124KB.
- The neon look comes from a starfield and gradient background with glowing blocks. The glow isn't drawn with `shadowBlur` every frame. It's pre-rendered to offscreen canvases and drawn as sprites, and particles are pooled, which keeps it light on phones.
- The game rules live in a pure TypeScript core that knows nothing about the DOM, canvas, or audio. Randomness comes from a seeded generator and time comes in as `dt`, so the same seed and the same inputs give the same run, and the rules are covered by unit tests.
- It is built with TypeScript and Vite, with no game engine, framework, or CDN. Source: https://github.com/devcol-main/Stack-Up
- Anything about how it was made (for example the use of AI tools) should come from the site owner. **확인 필요**

### 한국어 초안 (참고용)

### 소개 문단

Stack Up은 버튼 하나로 하는 탑 쌓기 게임이다. 블록이 화면 위를 좌우로 오가고, 원하는 순간에 탭하면 아래 블록 위로 떨어진다. 아래 블록과 겹치는 부분만 남고 삐져나온 부분은 잘려 나가기 때문에, 탑은 갈수록 좁아지고 블록은 점점 빨라진다. 완전히 겹치게 맞추는 "Perfect"를 이어가면 점수가 오르고 잘려 나간 폭도 조금씩 돌아온다. 블록이 아래 블록과 하나도 겹치지 않으면 게임이 끝난다. 한 판이 짧게 끝나는 게임이고(초안: 실제 평균 플레이 시간은 확인하지 않았다), 점수는 브라우저에 저장되어 Top 10으로 볼 수 있다.

### 플레이 방법

- 시작: 화면을 탭(클릭)하거나 Space.
- 블록 드롭: 탭, 클릭, Space. 키 입력은 게임 화면을 한 번 클릭한 뒤부터 먹는다.
- 음소거: 화면의 Sound 버튼 또는 `M` 키. 옵션(Options)에서 BGM/SFX 켜기와 볼륨, Reduced motion(화면 흔들림과 효과 축소), 기록 초기화를 설정한다.
- 게임 오버 후 닉네임을 적고 Submit하면 이 브라우저의 Top 10에 올라간다. 탭하면 재시작.

### 점수 규칙 (`src/core/config.ts`, `src/core/StackUpLogic.ts`)

- 블록을 쌓을 때마다 기본 1점.
- Perfect(아래 블록의 위치와 거의 일치): 기본 1점 + 콤보 보너스(현재 연속 Perfect 횟수, 최대 +5). 즉 Perfect 1연속은 2점, 5연속 이상은 한 번에 6점.
- Perfect 판정 허용치는 현재 블록 폭의 4.5%(최소 플레이 영역 폭의 0.6%). Perfect이면 블록이 아래 블록 위치에 딱 맞게 붙는다.
- 연속 Perfect 5회마다 블록 폭이 시작 폭(플레이 영역 폭의 55%)의 8%만큼 회복된다(시작 폭을 넘지는 않음).
- 연속 기록이 끊기면(잘려 나가면) 콤보는 0으로 돌아간다.
- 층수 마일스톤: 5층, 10층, 이후 10층 간격(20, 30, ...)에서 효과음과 "N FLOORS!" 표시.
- 난이도: 블록 속도가 층마다 올라간다. 시작 0.4 화면폭/초에서 층당 +0.025, 상한 1.2 화면폭/초(약 33층에서 상한 도달). 시작 방향은 판마다 무작위이고 이후 층마다 좌우로 번갈아 나온다.

### 팁 (초안)

1. 처음 몇 층은 속도가 느리니 Perfect을 노려 콤보를 쌓아라. 5연속마다 폭이 돌아오므로 초반 콤보가 후반 폭을 좌우한다.
2. 같은 층 안에서는 블록 속도가 일정하고 층마다 좌우로 번갈아 나온다. 블록이 지나가는 리듬을 눈으로 익힌 뒤 탭한다.
3. 폭이 좁아졌을 때는 무리하게 Perfect을 노리지 말고 "겹치기만" 하면서 살아남는다. 한 번 잘리는 폭이 작아지면 다음 블록도 작아지니 큰 실수를 피하는 게 우선이다.
4. 속도가 상한에 닿는 30층대부터는 속도가 더 오르지 않는다. 그때부터는 순수한 집중력 싸움이다.
5. Perfect은 C5부터 시작하는 장조 5음 음계의 음이 나고, 연속할수록 한 음씩 올라간다(최대 열 번째 음인 A6, 2옥타브에 조금 못 미침). 소리를 켜 두면 화면을 안 보고도 연속이 이어지는지 알 수 있다(`src/audio/audioConfig.ts`의 `scaleSemitones`, `perfectBaseFreq`, `perfectMaxStep`).

### 개발 노트 (초안)

- 사운드는 모두 합성이다. WebAudio 오실레이터와 노이즈로 효과음과 8분음표 스텝 시퀀서 BGM(A 마이너 펜타토닉, 108 BPM)을 만들었고, 오디오 파일이 하나도 없다. 덕분에 빌드 전체가 124KB다.
- 네온 비주얼: 별과 그라디언트 배경에 네온 글로우 블록. 글로우는 매 프레임 `shadowBlur`로 그리지 않고 오프스크린 캔버스에 미리 그려 둔 스프라이트로 그려서 모바일에서도 가볍다. 입자는 풀링한다.
- 결정론적 코어: 게임 규칙(`src/core`)은 DOM, Canvas, Audio를 전혀 모르는 순수 TypeScript이고, 난수는 시드 기반이며 시간은 dt로만 받는다. 같은 시드와 입력이면 결과가 같아서 규칙을 단위 테스트로 검증한다.
- 외부 엔진, 프레임워크, CDN 없이 TypeScript와 Vite로 만들었다.
- 소스: https://github.com/devcol-main/Stack-Up (README에 규칙과 기술 설명이 더 있다).
- AI 활용 여부 등 사이트 톤으로 쓸 만한 제작 후기는 사용자에게 받아서 보강할 것(**확인 필요**).

## 7. 업데이트 절차

1. Stack-Up 리포에서 게임을 수정한다(규칙/수치는 README, 이 문서의 6절과 어긋나지 않게 같이 고친다).
2. `npm run check` (`tsc --noEmit` + `vitest run`).
3. `npm run build && bash scripts/verify-build.sh`.
4. `bash scripts/copy-to-site.sh`로 사이트 리포에 복사.
5. 사이트 리포에서 `docs/public/games/stack-up/` 변경을 확인하고 로컬로 점검한 뒤 커밋한다. **사이트 쪽 커밋과 배포는 사이트 세션이 담당**한다.
6. 공유 형식(`devcol.player.*`, 리더보드 엔트리)을 바꿨다면 Bug-Squash의 `src/shared`도 맞춘다.

## 8. 사이트 세션 체크리스트

- [ ] Stack-Up 리포에서 `npm ci && npm run build && bash scripts/verify-build.sh`가 통과했다.
- [ ] `bash scripts/copy-to-site.sh` 실행 후 `docs/public/games/stack-up/`에 `index.html`, `assets/`, `licenses/Geist-OFL-LICENSE.txt`가 있다.
- [ ] 사이트 리포에서 로컬 확인: `npm run docs:dev` (`vitepress dev docs`), 배포 빌드 확인은 `npm run docs:build` 후 `npm run docs:preview` (`package.json`의 스크립트 이름).
- [ ] 게임 페이지(예: `docs/projects/stack-up.md`, 영어)에 iframe과 직접 쓴 설명 글(소개, 플레이 방법, 점수 규칙, 팁, 개발 노트)이 함께 있다. 6절 초안은 다듬어서 사용.
- [ ] `docs/.vitepress/theme/projects.ts`(카드)와 `docs/.vitepress/config.mts`의 `sidebar`에 등록했다(필요한 경우). 위치는 사용자와 결정.
- [ ] 데스크톱과 모바일(실기기 권장)에서: 첫 탭으로 시작 → 드롭 → 게임 오버 → Submit → Top 10 표시.
- [ ] 클릭 후 Space로 드롭, 탭을 숨겼다 돌아오면 일시정지/재개, 창 크기를 바꾸면 다시 그려진다.
- [ ] 소리가 첫 입력 후 나온다(iOS Safari는 무음 스위치/미디어 설정 영향 가능, **확인 필요**). `M` 키 음소거.
- [ ] 브라우저 콘솔에 404나 외부 요청이 없다(Network 탭에서 `/games/stack-up/` 밖으로 나가는 요청이 없어야 한다).
- [ ] 사이트의 Privacy Policy에 로컬 저장 안내를 더할지 결정했다(**확인 필요**).
- [ ] 사이트 sitemap에 새 페이지가 잡히는지, 사이트 톤(AI 투 문장 점검 포함)을 확인했다. 커밋과 푸시는 사이트 세션이 한다.
