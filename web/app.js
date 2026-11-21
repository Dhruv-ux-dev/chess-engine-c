import { Chess } from './chess.js';

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const FILES = 'abcdefgh';
const MATE = 29000;

const state = {
  game: new Chess(),
  player: 'w',
  orientation: 'w',
  thinkMs: 1000,
  book: true,
  selected: null,
  thinking: false,
  engineReady: false,
  gameId: 0,
  pendingId: 0,
  lastEval: null,
};

// ---------- engine ----------
const worker = new Worker('engine-worker.js');
worker.onmessage = ({ data }) => {
  if (data.type === 'ready') {
    state.engineReady = true;
    send('setoption name Book value true');
    maybeEngineMove();
    updateStatus();
    return;
  }
  const line = data.line || '';
  if (line.startsWith('info ')) onInfo(line);
  else if (line.startsWith('bestmove ')) onBestMove(line.split(' ')[1]);
};
const send = (cmd) => worker.postMessage(cmd);

function onInfo(line) {
  const num = (k) => { const m = line.match(new RegExp(`\\b${k} (-?\\d+)`)); return m ? +m[1] : null; };
  const cp = num('cp'), depth = num('depth'), nodes = num('nodes'), time = num('time');
  const pv = (line.split(' pv ')[1] || '').trim();
  // score is from the side to move (engine) — convert to White's view
  const white = state.game.turn() === 'w' ? cp : -cp;
  state.lastEval = white;
  $('s-eval').textContent = fmtEval(white);
  $('s-depth').textContent = depth;
  $('s-nodes').textContent = fmtNum(nodes);
  $('s-nps').textContent = time > 0 ? fmtNum(Math.round(nodes / time * 1000)) + '/s' : '–';
  $('s-pv').textContent = pvToSan(pv) || '–';
  setEvalBar(white);
}

function onBestMove(uci) {
  if (state.pendingId !== state.gameId) return; // stale result from a previous game
  state.thinking = false;
  if (uci && uci !== 'a1a1' && uci !== '0000') {
    // a book move arrives without an info line: show that
    if ($('s-depth').textContent === '…') { $('s-depth').textContent = 'book'; $('s-pv').textContent = '–'; }
    play({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
  }
  updateStatus();
}

function maybeEngineMove() {
  const g = state.game;
  if (!state.engineReady || state.thinking || g.isGameOver() || g.turn() === state.player) return;
  state.thinking = true;
  state.pendingId = state.gameId;
  ['s-eval', 's-depth', 's-nodes', 's-nps'].forEach((id) => ($(id).textContent = '…'));
  const moves = g.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || '')).join(' ');
  send('position startpos' + (moves ? ' moves ' + moves : ''));
  send('go movetime ' + state.thinkMs);
  updateStatus();
}

// ---------- moves ----------
function play(move) {
  try { state.game.move(move); } catch { return false; }
  state.selected = null;
  render();
  updateStatus();
  maybeEngineMove();
  return true;
}

function tryUserMove(from, to) {
  const legal = state.game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (!legal.length) return false;
  if (legal.some((m) => m.promotion)) { askPromotion(from, to); return true; }
  return play({ from, to });
}

function askPromotion(from, to) {
  const c = state.game.turn();
  const promo = $('promo');
  promo.innerHTML = '<div class="pick">' + ['q', 'r', 'b', 'n']
    .map((p) => `<button data-p="${p}"><img src="pieces/${c}${p.toUpperCase()}.svg" alt="${p}"></button>`).join('') + '</div>';
  promo.hidden = false;
  promo.onclick = (e) => {
    const b = e.target.closest('button');
    promo.hidden = true;
    if (b) play({ from, to, promotion: b.dataset.p });
    else { state.selected = null; render(); }
  };
}

// ---------- rendering ----------
function squares() {
  const ranks = state.orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = state.orientation === 'w' ? FILES : [...FILES].reverse().join('');
  return ranks.flatMap((r) => [...files].map((f) => f + r));
}

function render() {
  const g = state.game;
  const last = g.history({ verbose: true }).at(-1);
  const targets = state.selected ? g.moves({ square: state.selected, verbose: true }) : [];
  const checkSq = g.inCheck() ? findKing(g.turn()) : null;
  const sqs = squares();
  boardEl.innerHTML = '';
  sqs.forEach((sq, i) => {
    const f = FILES.indexOf(sq[0]), r = +sq[1];
    const el = document.createElement('div');
    el.className = 'sq ' + ((f + r) % 2 ? 'l' : 'd');
    el.dataset.sq = sq;
    if (last && (sq === last.from || sq === last.to)) el.classList.add('last');
    if (sq === state.selected) el.classList.add('sel');
    if (sq === checkSq) el.classList.add('check');
    const t = targets.find((m) => m.to === sq);
    if (t) el.classList.add('tgt', ...(t.captured ? ['cap'] : []));
    const p = g.get(sq);
    if (p) {
      const img = document.createElement('img');
      img.src = `pieces/${p.color}${p.type.toUpperCase()}.svg`;
      img.alt = p.color + p.type;
      img.draggable = false;
      el.appendChild(img);
    }
    if (i % 8 === 0) el.insertAdjacentHTML('beforeend', `<span class="coord r">${r}</span>`);
    if (i >= 56) el.insertAdjacentHTML('beforeend', `<span class="coord f">${sq[0]}</span>`);
    boardEl.appendChild(el);
  });
  renderMoves();
  renderPlayers();
}

function renderMoves() {
  const hist = state.game.history();
  const ol = $('moves');
  ol.innerHTML = '';
  for (let i = 0; i < hist.length; i += 2) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${hist[i]}</span><span>${hist[i + 1] || ''}</span>`;
    ol.appendChild(li);
  }
  const all = ol.querySelectorAll('span');
  const cur = [...all].filter((s) => s.textContent).at(-1);
  if (cur) cur.classList.add('cur');
  ol.scrollTop = ol.scrollHeight;
}

function renderPlayers() {
  const topColor = state.orientation === 'w' ? 'b' : 'w';
  const name = (c) => (c === state.player ? 'You' : 'AlphaBeta');
  $('topname').textContent = name(topColor);
  $('botname').textContent = name(topColor === 'w' ? 'b' : 'w');
  $('topdot').className = 'dot ' + topColor;
  $('botdot').className = 'dot ' + (topColor === 'w' ? 'b' : 'w');
  document.querySelector('.top-player').classList.toggle('thinking', state.thinking && topColor !== state.player);
  document.querySelector('.bottom-player').classList.toggle('thinking', state.thinking && topColor === state.player);
}

function updateStatus() {
  const g = state.game;
  let s;
  if (!state.engineReady) s = 'Loading engine…';
  else if (g.isCheckmate()) s = g.turn() === state.player ? 'Checkmate — AlphaBeta wins.' : 'Checkmate — you win!';
  else if (g.isStalemate()) s = 'Draw by stalemate.';
  else if (g.isThreefoldRepetition()) s = 'Draw by threefold repetition.';
  else if (g.isInsufficientMaterial()) s = 'Draw — insufficient material.';
  else if (g.isDraw()) s = 'Draw by the fifty-move rule.';
  else if (state.thinking) s = 'AlphaBeta is thinking…';
  else s = (g.inCheck() ? 'Check! ' : '') + 'Your move.';
  $('status').textContent = s;
  renderPlayers();
}

function setEvalBar(white) {
  const clamp = Math.max(-1000, Math.min(1000, white));
  const pct = Math.abs(white) > MATE ? (white > 0 ? 100 : 0) : 50 + 50 * (2 / (1 + Math.exp(-clamp / 250)) - 1);
  $('evalfill').style.height = pct + '%';
  $('evaltext').textContent = fmtEval(white);
}

// ---------- input (click + drag) ----------
let drag = null;
boardEl.addEventListener('pointerdown', (e) => {
  const sqEl = e.target.closest('.sq');
  if (!sqEl || state.thinking || state.game.turn() !== state.player || !$('promo').hidden) return;
  const sq = sqEl.dataset.sq;
  const p = state.game.get(sq);
  if (state.selected && state.selected !== sq && (!p || p.color !== state.player)) {
    if (!tryUserMove(state.selected, sq)) { state.selected = null; render(); }
    return;
  }
  if (p && p.color === state.player) {
    state.selected = sq;
    render();
    const img = boardEl.querySelector(`[data-sq="${sq}"] img`);
    const ghost = img.cloneNode();
    ghost.className = 'ghost';
    ghost.style.width = ghost.style.height = img.getBoundingClientRect().width + 'px';
    drag = { from: sq, ghost, img, moved: false };
    moveGhost(e);
  }
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.moved) { document.body.appendChild(drag.ghost); drag.img.classList.add('drag'); drag.moved = true; }
  moveGhost(e);
});
window.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const { from, moved, ghost } = drag;
  drag = null;
  ghost.remove();
  if (!moved) return; // plain click: keep selection
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.sq');
  if (!target || target.dataset.sq === from || !tryUserMove(from, target.dataset.sq)) render();
});
function moveGhost(e) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }

// ---------- controls ----------
function seg(id, cb) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    cb(b.dataset.v);
  });
}
seg('side', (v) => { state.player = v; state.orientation = v; newGame(); });
seg('time', (v) => (state.thinkMs = +v));
seg('book', (v) => { state.book = v === 'true'; send('setoption name Book value ' + v); });
$('new').onclick = newGame;
$('flip').onclick = () => { state.orientation = state.orientation === 'w' ? 'b' : 'w'; render(); };
$('undo').onclick = () => {
  if (state.thinking) return;
  state.game.undo();
  if (state.game.turn() !== state.player) state.game.undo();
  state.selected = null;
  render();
  updateStatus();
};

function newGame() {
  state.gameId++;
  state.thinking = false;
  state.game = new Chess();
  state.selected = null;
  send('ucinewgame');
  ['s-eval', 's-depth', 's-nodes', 's-nps', 's-pv'].forEach((id) => ($(id).textContent = '–'));
  setEvalBar(0);
  render();
  updateStatus();
  maybeEngineMove();
}

// ---------- helpers ----------
function findKing(color) {
  for (const sq of squares()) { const p = state.game.get(sq); if (p && p.type === 'k' && p.color === color) return sq; }
  return null;
}
function fmtEval(cp) {
  if (cp == null || Number.isNaN(cp)) return '–';
  if (Math.abs(cp) > MATE) return (cp > 0 ? '+' : '−') + 'M';
  const v = (cp / 100).toFixed(1);
  return cp > 0 ? '+' + v : v.replace('-', '−');
}
function fmtNum(n) {
  if (n == null) return '–';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
function pvToSan(pv) {
  if (!pv) return '';
  const g = new Chess(state.game.fen());
  const out = [];
  for (const u of pv.split(/\s+/).slice(0, 8)) {
    try { out.push(g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; }
  }
  return out.join(' ');
}

render();
setEvalBar(0);
updateStatus();
