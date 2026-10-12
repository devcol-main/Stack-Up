import type { LeaderboardEntry } from '../../../../shared/leaderboard';
import type { Phase } from './flow';

function el<T extends HTMLElement>(id: string, ctor: { new (): T }): T {
  const e = document.getElementById(id);
  if (!(e instanceof ctor)) throw new Error(`#${id} not found`);
  return e;
}

export interface GameOverView {
  score: number;
  best: number;
}

/**
 * HTML 오버레이 UI. 모든 갱신은 값이 바뀔 때만 DOM에 쓴다(매 프레임 호출해도 비용 없음).
 * 오버레이라서 캔버스 화면 흔들림의 영향을 받지 않는다.
 */
export class StackUpUi {
  readonly root = el('ui', HTMLDivElement);
  readonly muteButton = el('mute', HTMLButtonElement);
  readonly form = el('nick-form', HTMLFormElement);
  readonly input = el('nick', HTMLInputElement);
  readonly retryButton = el('retry', HTMLButtonElement);
  private readonly score = el('score', HTMLDivElement);
  private readonly perfect = el('perfect', HTMLDivElement);
  private readonly finalScore = el('final-score', HTMLDivElement);
  private readonly best = el('best', HTMLDivElement);
  private readonly board = el('board', HTMLOListElement);
  private readonly rows: { li: HTMLLIElement; rank: HTMLSpanElement; name: HTMLSpanElement; pts: HTMLSpanElement }[] = [];
  private readonly emptyRow: HTMLLIElement;
  private shownScore = -1;
  private phase: Phase | '' = '';

  constructor(rowCount: number) {
    for (let i = 0; i < rowCount; i++) {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      const name = document.createElement('span');
      const pts = document.createElement('span');
      rank.className = 'rank';
      name.className = 'name';
      pts.className = 'pts';
      li.append(rank, name, pts);
      li.hidden = true;
      this.board.append(li);
      this.rows.push({ li, rank, name, pts });
    }
    this.emptyRow = document.createElement('li');
    this.emptyRow.className = 'empty';
    this.emptyRow.textContent = 'No scores yet';
    this.emptyRow.hidden = true;
    this.board.append(this.emptyRow);
  }

  /** 폰트 준비 후(또는 타임아웃 후) UI를 보여준다. */
  show(): void {
    this.root.classList.add('ready');
  }

  setPhase(p: Phase): void {
    if (p === this.phase) return;
    this.phase = p;
    this.root.dataset.phase = p;
  }

  /** 값이 바뀔 때만 DOM을 갱신. */
  setScore(n: number): void {
    if (n === this.shownScore) return;
    this.shownScore = n;
    this.score.textContent = String(n);
  }

  /** PERFECT 연출 시작. 콤보 2 이상이면 `PERFECT ×n`. */
  flashPerfect(combo: number): void {
    this.perfect.textContent = combo >= 2 ? `PERFECT ×${combo}` : 'PERFECT';
    const el = this.perfect;
    if (!el.classList.contains('show')) {
      el.classList.add('show');
      return;
    }
    // 이미 재생 중/종료(fill forwards)면 Web Animations API로 처음부터 다시 재생 (강제 reflow 없음)
    const anims = typeof el.getAnimations === 'function' ? el.getAnimations() : [];
    if (anims.length === 0) {
      el.classList.remove('show');
      void el.offsetWidth; // 구형 브라우저 폴백
      el.classList.add('show');
      return;
    }
    for (let i = 0; i < anims.length; i++) {
      anims[i]!.cancel();
      anims[i]!.play();
    }
  }

  setMuted(m: boolean): void {
    this.muteButton.textContent = m ? 'Sound: off' : 'Sound: on';
    this.muteButton.setAttribute('aria-pressed', String(m));
  }

  showGameOver(v: GameOverView, nickname: string): void {
    this.perfect.classList.remove('show');
    this.finalScore.textContent = String(v.score);
    this.best.textContent = `BEST ${v.best}`;
    this.form.hidden = false;
    this.input.value = nickname;
    this.clearBoard(); // 로딩 중: 빈 행 문구도 숨김
  }

  private clearBoard(): void {
    for (let i = 0; i < this.rows.length; i++) this.rows[i]!.li.hidden = true;
    this.emptyRow.hidden = true;
  }

  hideNickForm(): void {
    this.form.hidden = true;
  }

  /** Top N 표시. mine과 같은 항목(닉네임/점수/ts)을 하이라이트. */
  renderBoard(entries: readonly LeaderboardEntry[], mine: LeaderboardEntry | null): void {
    let highlighted = false;
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i]!;
      const e = entries[i];
      if (!e) {
        r.li.hidden = true;
        continue;
      }
      r.li.hidden = false;
      r.rank.textContent = String(i + 1);
      r.name.textContent = e.nickname;
      r.pts.textContent = String(e.score);
      const isMine = !highlighted && mine !== null && e.ts === mine.ts && e.score === mine.score && e.nickname === mine.nickname;
      if (isMine) highlighted = true;
      r.li.classList.toggle('me', isMine);
    }
    this.emptyRow.hidden = entries.length > 0;
  }
}
