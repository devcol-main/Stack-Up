# Assets

라이선스가 확인된 에셋만 사용한다. 외부 CDN 의존 금지(폰트, 사운드 모두 저장소에 포함).

| 에셋 | 파일 | 출처 URL | 라이선스 | 사용처 | 추가일 |
|---|---|---|---|---|---|
| Geist (variable, latin subset, wght 100–900) | src/assets/fonts/geist-latin-wght-normal.woff2 (라이선스: public/licenses/Geist-OFL-LICENSE.txt, 빌드 시 dist/licenses/로 함께 배포) | https://github.com/vercel/geist-font (npm: @fontsource-variable/geist 5.3.0, 로컬 devcol-site node_modules에서 복사) | SIL OFL 1.1 | Stack Up 점수/로고/화면 텍스트 (800 굵기) | 2026-10-13 |
| DevCol logo (256x256 PNG, 투명 배경) | src/assets/devcol-logo.png | DevCol 소유 (원본: devcol-site/devcol-build/docs/public/logo.png) | DevCol 소유 — 이 저장소의 Apache-2.0 코드 라이선스와 별개로 상표/로고 사용 권리는 DevCol에 있음 | Stack Up 파비콘(좌상단 화면 로고는 아래 dark 변형 사용) | 2026-10-13 |
| DevCol logo, dark-background variant | src/assets/devcol-logo-dark.png | 위 DevCol logo에서 `node scripts/make-dark-logo.mjs`로 파생(검정 → 흰색, 훅 빨강 207,23,23 유지, 알파 유지). 원본은 DevCol 소유 | DevCol 소유 — 이 저장소의 Apache-2.0 코드 라이선스와 별개로 상표/로고 사용 권리는 DevCol에 있음 | Stack Up 좌상단 로고(모든 화면). 파비콘은 원본 사용 | 2026-10-13 |

Bug Squash 에셋은 [devcol-main/Bug-Squash의 docs/assets.md](https://github.com/devcol-main/Bug-Squash/blob/main/docs/assets.md)에 있다 (2026-10-15 분리).
