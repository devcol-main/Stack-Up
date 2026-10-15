# Task 012: Stack Up을 독립 리포로 분리하고 사이트 업로드 준비

상태: 확정 (사용자 요청 2026-10-15: "Bug Squash처럼 Stack Up도 개별로 분리해서 사이트에 올릴 준비")
작성일: 2026-10-15
리포: `devcol-main/Stack-Up` (공개, Apache-2.0). 로컬 `/Users/in9/Programmings/Stack-Up`
선행 사례: Bug Squash 분리 (`devcol-main/Bug-Squash`의 커밋 `cfb4b4d` "Set up Bug Squash as a standalone repository"). **같은 구조와 관례를 따른다.**
범위 밖: 사이트(devcol-site)에 실제로 올리는 작업 — 사용자가 devcol-site 프로젝트 세션에서 진행한다. 게임 동작 변경.

## 현재 상태
- `devcol-main/Arcade-Web`의 `games/stack-up` 히스토리를 `git subtree split`으로 보존해 이 리포의 `main`에 가져왔다(18커밋, 트리 해시 `dcb1bf0`가 Arcade-Web `main`의 `games/stack-up`과 같음).
- 루트에 `index.html`, `public/`, `src/`, `tests/`만 있고 빌드/테스트 설정, 공유 코드, 문서가 없다.

## 할 일 (하위 작업 1: 독립 리포 구성)
Bug-Squash(`/Users/in9/Programmings/Bug-Squash`)의 루트 구성을 기준으로 맞춘다. 원본 자료는 Arcade-Web `main`(`git -C /Users/in9/Programmings/devcol-arcade-web show origin/main:<path>`로 읽기만)에서 가져온다.
1. 빌드/테스트 설정: `package.json`(name `stack-up`, scripts: dev/build/typecheck/test/check/media, devDependencies는 Arcade-Web과 같은 버전), `package-lock.json`(`npm install`로 생성, 새 의존성 없음), `vite.config.ts`(base `./`, outDir `dist`, target es2020), `tsconfig.json`, `vitest.config.ts`(tests/**), `.nvmrc`(24), `.gitignore`.
2. 공유 코드: Arcade-Web의 `shared/leaderboard`, `shared/player`를 `src/shared/`로 복사(테스트는 `tests/shared/...`로). Stack Up의 import 경로(`../../../shared/...` 등)를 새 위치로 고친다. `shared/ranking`은 가져오지 않는다(Stack Up이 쓰지 않음). 공유 형식(저장 키, 엔트리 구조)은 **바꾸지 않는다**(같은 도메인에서 Bug Squash와 런타임에 공유).
3. 스크립트: `scripts/copy-to-site.sh`(dist → `../devcol-site/devcol-build/docs/public/games/stack-up`, Bug-Squash 것과 같은 형태), `scripts/verify-build.sh`(단일 `dist` 기준: 용량 한도 300KB, 개발 훅 `__stackUp` 검사), `scripts/capture-media.mjs`+`scripts/lib/`(경로를 루트 기준으로 수정, `npm run media`가 동작해야 함), `scripts/make-dark-logo.mjs`(경로 수정). 
4. CI: `.github/workflows/ci.yml`(Arcade-Web 것과 같은 구성: npm ci → check → build → verify-build).
5. 라이선스/문서: `LICENSE`(Apache-2.0 정식 텍스트, Arcade-Web 것 그대로), `NOTICE`(Stack Up 기준: Geist OFL, DevCol 로고 소유 표기), `docs/assets.md`(Stack Up 행만), `docs/pipeline-log.md`(Stack Up 관련 행 + Task 012 행), `docs/tasks/`(Arcade-Web의 001·002·003·007·008 명세를 기록으로 복사, `docs/tasks/README.md`에 "경로는 당시 모노레포 기준" 메모), `docs/mockups/stack-up-neon.html`, `docs/media/`(README 미디어).
6. 에이전트 설정: `.claude/agents/`(web-implementer, web-reviewer, web-test-runner)와 `.claude/settings.json`, `CLAUDE.md`(Bug-Squash의 CLAUDE.md처럼 단일 게임 리포 기준으로 수정; 비주얼은 Neon).
7. README: `README.md`(영어)와 `README.ko.md`(한국어). Bug-Squash README처럼 How to play / Rules / Scoring / Difficulty / Design notes / Technical notes 구성, 상단에 GIF, 스크린샷 표, CI 배지, 라이선스. 게임 규칙·수치는 실제 코드(`src/core/config.ts` 등)와 일치해야 한다.

## 할 일 (하위 작업 2: 사이트 업로드 준비)
- `docs/site-integration.md`: devcol-site 세션이 이 문서만 보고 작업할 수 있게 작성.
  - 빌드와 복사 명령, 산출물 구조(상대 경로, 외부 CDN 없음, 용량), 복사 위치
  - VitePress 임베드 예시(iframe: 권장 비율/높이, `title`, `loading`, 오디오는 첫 입력 후 시작, 키보드 포커스는 첫 탭 후), iframe 안 동작(탭 숨김 시 일시정지, 리사이즈 대응)
  - 저장소: 사용하는 localStorage 키 목록(같은 도메인에서 Bug Squash와 공유되는 키 포함)
  - 라이선스 표기 의무(Geist OFL 파일 동반, DevCol 로고는 DevCol 소유)
  - 게임 페이지 글 재료: 사이트 페이지에 쓸 수 있는 소개·플레이 방법·팁 초안(한국어). AdSense 심사를 위해 직접 쓴 설명 글이 필요하다는 점과, 이 초안은 출발점일 뿐 사이트 세션에서 다듬어야 한다는 점을 명시.
  - 업데이트 절차(게임 수정 → 빌드 → 복사 → 사이트 커밋)

## 완료 조건
- [x] `npm ci && npm run check` 통과(기존 Stack Up 테스트 + shared 테스트)
- [x] `npm run build` 성공, `bash scripts/verify-build.sh` 통과(300KB 이하, 개발 훅 없음)
- [x] `npm run media` 동작(시드 7 결과가 분리 전과 같음: score 61, floors 15, maxCombo 11)
- [ ] 개발 서버에서 게임이 정상 동작(타이틀 → 플레이 → 게임 오버 → Top 10)
- [x] README 영/한, `docs/site-integration.md` 작성
- [ ] 원격 리포 생성·푸시 후 CI 통과
