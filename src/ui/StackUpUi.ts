import { NICKNAME_RULE_TEXT, nicknameFormatOk, type LeaderboardEntry } from '../shared/leaderboard';
import type { Phase } from './flow';
import { milestoneText } from './options';

/** WAAPI 재시작 패턴: 이미 재생/종료된 애니메이션을 처음부터 다시 재생한다(강제 reflow 없음). */
function replay(el: HTMLElement): void {
  if (!el.classList.contains('show')) {
    el.classList.add('show');
    return;
  }
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

function el<T extends HTMLElement>(id: string, ctor: { new (): T }): T {
  const e = document.getElementById(id);
  if (!(e instanceof ctor)) throw new Error(`#${id} not found`);
  return e;
}

/** 옵션의 "Online scores: Delete mine" 버튼 상태. */
export type LbDeleteState = 'idle' | 'armed' | 'busy' | 'deleted' | 'none' | 'failed';

const LB_DELETE_TEXT: Record<LbDeleteState, string> = {
  idle: 'Delete mine',
  armed: 'Tap again to confirm',
  busy: 'Deleting…',
  deleted: 'Deleted',
  none: 'Nothing to delete',
  failed: 'Failed, try again',
};

/** 신고 버튼 두 번째 탭을 기다리는 시간(ms). */
const REPORT_CONFIRM_MS = 3000;

interface BoardRow {
  li: HTMLLIElement;
  rank: HTMLSpanElement;
  name: HTMLSpanElement;
  pts: HTMLSpanElement;
  report: HTMLButtonElement;
  entryId: number | null;
  armedTimer: ReturnType<typeof setTimeout> | null;
}

export interface GameOverView {
  score: number;
  best: number;
  isNewBest: boolean;
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
  readonly optionsButton = el('options-btn', HTMLButtonElement);
  readonly optionsPanel = el('options', HTMLDivElement);
  readonly optSound = el('opt-sound', HTMLButtonElement);
  readonly optBgm = el('opt-bgm', HTMLButtonElement);
  readonly optBgmVol = el('opt-bgm-vol', HTMLInputElement);
  readonly optSfx = el('opt-sfx', HTMLButtonElement);
  readonly optSfxVol = el('opt-sfx-vol', HTMLInputElement);
  readonly optReduced = el('opt-rm', HTMLButtonElement);
  readonly optReset = el('opt-reset', HTMLButtonElement);
  readonly optClose = el('opt-close', HTMLButtonElement);
  readonly optLbDelete = el('opt-lb-delete', HTMLButtonElement);
  private readonly nickRule = el('nick-rule', HTMLParagraphElement);
  private readonly boardNote = el('board-note', HTMLParagraphElement);
  /** 순위표의 Report 확인 후 호출. 서버가 받으면 true. main이 연결한다. */
  onReport: ((entryId: number) => Promise<boolean>) | null = null;
  private readonly perfect = el('perfect', HTMLDivElement);
  private readonly milestone = el('milestone', HTMLDivElement);
  private readonly hudBest = el('hud-best', HTMLDivElement);
  private readonly titleBest = el('title-best', HTMLDivElement);
  private readonly newBest = el('new-best', HTMLDivElement);
  private readonly finalScore = el('final-score', HTMLDivElement);
  private readonly best = el('best', HTMLDivElement);
  private readonly board = el('board', HTMLOListElement);
  private readonly rows: BoardRow[] = [];
  private readonly emptyRow: HTMLLIElement;
  private shownScore = -1;
  private shownHudBest = -1;
  private shownTitleBest = -1;
  private phase: Phase | '' = '';

  constructor(rowCount: number) {
    for (let i = 0; i < rowCount; i++) {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      const name = document.createElement('span');
      const pts = document.createElement('span');
      const report = document.createElement('button');
      rank.className = 'rank';
      name.className = 'name';
      pts.className = 'pts';
      report.className = 'report';
      report.type = 'button';
      report.textContent = 'Report';
      report.hidden = true;
      li.append(rank, name, pts, report);
      li.hidden = true;
      this.board.append(li);
      const row: BoardRow = { li, rank, name, pts, report, entryId: null, armedTimer: null };
      report.addEventListener('click', () => this.pressReport(row));
      this.rows.push(row);
    }
    this.nickRule.textContent = NICKNAME_RULE_TEXT;
    this.input.addEventListener('input', () => this.checkNick());
    // 로고 로드 실패 시 깨진 이미지/alt 텍스트 대신 숨긴다(게임 동작과 무관)
    for (const img of Array.from(this.root.querySelectorAll<HTMLImageElement>('.brand-logo'))) {
      const hide = (): void => {
        img.hidden = true;
      };
      img.addEventListener('error', hide);
      if (img.complete && img.naturalWidth === 0) hide();
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
    replay(this.perfect);
  }

  /** 마일스톤 팝업. 연속 발생하면 처음부터 다시 재생. */
  flashMilestone(floors: number): void {
    this.milestone.textContent = milestoneText(floors);
    replay(this.milestone);
  }

  /** 값이 바뀔 때만 DOM 갱신. 0이면 숨긴다. */
  setHudBest(n: number): void {
    if (n === this.shownHudBest) return;
    this.shownHudBest = n;
    this.hudBest.hidden = n <= 0;
    this.hudBest.textContent = `BEST ${n}`;
  }

  setTitleBest(n: number): void {
    if (n === this.shownTitleBest) return;
    this.shownTitleBest = n;
    this.titleBest.hidden = n <= 0;
    this.titleBest.textContent = `BEST ${n}`;
  }

  /** 축소 모드(OS 설정 OR 수동 설정)를 CSS 클래스로 반영. */
  setReducedMotion(on: boolean): void {
    this.root.classList.toggle('reduced', on);
    this.optReduced.textContent = on ? 'On' : 'Off';
    this.optReduced.setAttribute('aria-pressed', String(on));
  }

  setMuted(m: boolean): void {
    this.muteButton.textContent = m ? 'Sound: off' : 'Sound: on';
    this.muteButton.setAttribute('aria-pressed', String(m));
    // 옵션의 전체 사운드 토글: On = 소리 켜짐
    this.optSound.textContent = m ? 'Off' : 'On';
    this.optSound.setAttribute('aria-pressed', String(!m));
  }

  /** 오디오 설정을 옵션 컨트롤에 반영. 사용자가 드래그 중인 슬라이더는 건드리지 않는다. */
  syncAudio(a: { bgmOn: boolean; sfxOn: boolean; bgmVolume: number; sfxVolume: number }): void {
    this.optBgm.textContent = a.bgmOn ? 'On' : 'Off';
    this.optBgm.setAttribute('aria-pressed', String(a.bgmOn));
    this.optSfx.textContent = a.sfxOn ? 'On' : 'Off';
    this.optSfx.setAttribute('aria-pressed', String(a.sfxOn));
    const bv = String(Math.round(a.bgmVolume * 100));
    const sv = String(Math.round(a.sfxVolume * 100));
    if (this.optBgmVol.value !== bv) this.optBgmVol.value = bv;
    if (this.optSfxVol.value !== sv) this.optSfxVol.value = sv;
  }

  setOptionsOpen(open: boolean): void {
    this.optionsPanel.hidden = !open;
    this.root.classList.toggle('options-open', open);
  }

  /** Reset data 버튼의 확인 단계 표시. */
  setResetArmed(armed: boolean): void {
    this.optReset.textContent = armed ? 'Tap again to confirm' : 'Reset data';
    this.optReset.classList.toggle('armed', armed);
  }

  /** 입력 중인 닉네임이 형식에 안 맞으면 규칙 문구를 경고색으로. */
  private checkNick(): void {
    this.nickRule.classList.toggle('bad', !nicknameFormatOk(this.input.value));
  }

  /** 옵션의 온라인 기록 삭제 버튼 표시. */
  setLbDeleteState(s: LbDeleteState): void {
    this.optLbDelete.textContent = LB_DELETE_TEXT[s];
    this.optLbDelete.classList.toggle('armed', s === 'armed');
    this.optLbDelete.disabled = s === 'busy';
  }

  /** 순위표 위 안내 문구 (오프라인, 이름이 바뀜 등). null이면 숨긴다. */
  setBoardNote(text: string | null): void {
    this.boardNote.hidden = text === null;
    this.boardNote.textContent = text ?? '';
  }

  private resetReport(row: BoardRow): void {
    if (row.armedTimer !== null) clearTimeout(row.armedTimer);
    row.armedTimer = null;
    row.report.textContent = 'Report';
    row.report.classList.remove('armed');
    row.report.disabled = false;
  }

  /** 첫 탭은 확인 대기("Report?"), 제한 시간 안의 두 번째 탭에서 보낸다. */
  private pressReport(row: BoardRow): void {
    const id = row.entryId;
    if (id === null || row.report.disabled) return;
    if (row.armedTimer === null) {
      row.report.textContent = 'Report?';
      row.report.classList.add('armed');
      row.armedTimer = setTimeout(() => this.resetReport(row), REPORT_CONFIRM_MS);
      return;
    }
    this.resetReport(row);
    row.report.disabled = true;
    row.report.textContent = '…';
    const send = this.onReport ? this.onReport(id) : Promise.resolve(false);
    send.then(
      (ok) => {
        if (row.entryId === id) row.report.textContent = ok ? 'Reported' : 'Failed';
      },
      () => {
        if (row.entryId === id) row.report.textContent = 'Failed';
      },
    );
  }

  showGameOver(v: GameOverView, nickname: string): void {
    this.newBest.hidden = !v.isNewBest;
    this.perfect.classList.remove('show');
    this.milestone.classList.remove('show');
    this.finalScore.textContent = String(v.score);
    this.best.textContent = `BEST ${v.best}`;
    this.form.hidden = false;
    this.input.value = nickname;
    this.checkNick();
    this.setBoardNote(null);
    this.clearBoard(); // 로딩 중: 빈 행 문구도 숨김
  }

  /** 데이터 초기화 후 게임 오버 화면의 기록 표시/닉네임 입력을 맞춘다. */
  refreshAfterReset(): void {
    this.best.textContent = 'BEST 0';
    this.newBest.hidden = true;
    // 닉네임 입력칸은 공통 프로필 값이므로 Reset이 건드리지 않는다.
  }

  private clearBoard(): void {
    for (let i = 0; i < this.rows.length; i++) this.rows[i]!.li.hidden = true;
    this.emptyRow.hidden = true;
  }

  hideNickForm(): void {
    this.form.hidden = true;
  }

  /**
   * Top N 표시. isMine이 true인 첫 항목을 하이라이트한다.
   * reportable이면(온라인 순위표) 내 줄이 아닌 줄에 Report 버튼을 보인다.
   */
  renderBoard<T extends LeaderboardEntry>(entries: readonly T[], isMine: (e: T) => boolean, reportable = false): void {
    let highlighted = false;
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i]!;
      const e = entries[i];
      this.resetReport(r);
      if (!e) {
        r.li.hidden = true;
        r.entryId = null;
        r.report.hidden = true;
        continue;
      }
      r.li.hidden = false;
      r.rank.textContent = String(i + 1);
      r.name.textContent = e.nickname;
      r.pts.textContent = String(e.score);
      const mine = !highlighted && isMine(e);
      if (mine) highlighted = true;
      r.li.classList.toggle('me', mine);
      r.entryId = e.entryId ?? null;
      r.report.hidden = !reportable || mine || r.entryId === null;
    }
    this.emptyRow.hidden = entries.length > 0;
  }
}
