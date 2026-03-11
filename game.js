/**
 * InterCross-Toe game logic
 * - Players can place on cells or intersections.
 * - Placing on an intersection forbids the 4 surrounding cells for the opponent; overlapping forbidden cells are unlocked.
 * - Grid size and win length are configurable.
 */

(function () {
  const CELL_SIZE = 44;

  const ROOM_ID = 'room1'; // simple single-room demo
  let applyingSnapshot = false;

  let gridSize = 5;
  let winLength = 4;
  let currentPlayer = 'X';
  let currentLang = 'en';

  const i18n = {
    en: {
      subtitle: 'Play on cells or intersections · Overlapping forbidden zones unlock',
      settingsTitle: 'Settings',
      gridSizeLabel: 'Board size',
      gridSizeHint: 'N×N cells, (N+1)×(N+1) intersections',
      winLengthLabel: 'Win length',
      winLengthHint: 'K in a line to win',
      newGame: 'New game',
      statusCurrent: (p) => `Current: ${p}`,
      statusWinner: (p) => `Winner: ${p}`,
      statusDraw: 'Draw',
    },
    zh: {
      subtitle: '在格子或交叉处落子 · 禁区重叠可解禁',
      settingsTitle: '设置',
      gridSizeLabel: '棋盘大小',
      gridSizeHint: 'N×N 格子，(N+1)×(N+1) 交叉点',
      winLengthLabel: '连子数量',
      winLengthHint: '同一直线 K 子即胜',
      newGame: '新对局',
      statusCurrent: (p) => `当前：${p}`,
      statusWinner: (p) => `获胜：${p}`,
      statusDraw: '平局',
    },
  };

  // Grid cells: gridSize x gridSize, value: null | 'X' | 'O'
  let cellBoard = [];
  // Intersection board: (gridSize+1) x (gridSize+1)
  let interBoard = [];
  // Forbidden info per cell: cellForbidden[i][j] = Set of 'X'|'O'; size===2 means overlapped and unlocked
  let cellForbidden = [];
  let gameOver = false;

  const boardWrap = document.getElementById('boardWrap');
  const gameStatus = document.getElementById('gameStatus');
  const inputGridSize = document.getElementById('gridSize');
  const inputWinLength = document.getElementById('winLength');
  const btnNewGame = document.getElementById('btnNewGame');

  function t(key, ...args) {
    const pack = i18n[currentLang] || i18n.en;
    const val = pack[key];
    if (typeof val === 'function') return val(...args);
    return val ?? '';
  }

  function applyStaticTexts() {
    const subtitleEl = document.getElementById('subtitle');
    const settingsTitleEl = document.getElementById('settingsTitle');
    const labelGridSizeEl = document.getElementById('labelGridSize');
    const hintGridSizeEl = document.getElementById('hintGridSize');
    const labelWinLengthEl = document.getElementById('labelWinLength');
    const hintWinLengthEl = document.getElementById('hintWinLength');
    const btnNewGameEl = document.getElementById('btnNewGame');

    if (subtitleEl) subtitleEl.textContent = t('subtitle');
    if (settingsTitleEl) settingsTitleEl.textContent = t('settingsTitle');
    if (labelGridSizeEl) labelGridSizeEl.textContent = t('gridSizeLabel');
    if (hintGridSizeEl) hintGridSizeEl.textContent = t('gridSizeHint');
    if (labelWinLengthEl) labelWinLengthEl.textContent = t('winLengthLabel');
    if (hintWinLengthEl) hintWinLengthEl.textContent = t('winLengthHint');
    if (btnNewGameEl) btnNewGameEl.textContent = t('newGame');
  }

  function updateLangButtons() {
    const btnEn = document.getElementById('btnLangEn');
    const btnZh = document.getElementById('btnLangZh');
    if (!btnEn || !btnZh) return;
    btnEn.classList.toggle('active', currentLang === 'en');
    btnZh.classList.toggle('active', currentLang === 'zh');
  }

  function setStatusCurrent() {
    gameStatus.textContent = t('statusCurrent', currentPlayer);
  }

  function setStatusWinner() {
    gameStatus.textContent = t('statusWinner', currentPlayer);
  }

  function setStatusDraw() {
    gameStatus.textContent = t('statusDraw');
  }

  function getOpponent(p) {
    return p === 'X' ? 'O' : 'X';
  }

  /** 4 surrounding cells of intersection (ri, rj) within bounds */
  function getCellsAroundIntersection(ri, rj) {
    const cells = [];
    for (const di of [0, 1]) {
      for (const dj of [0, 1]) {
        const r = ri - 1 + di;
        const c = rj - 1 + dj;
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
          cells.push([r, c]);
        }
      }
    }
    return cells;
  }

  function initState() {
    cellBoard = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    interBoard = Array.from({ length: gridSize + 1 }, () => Array(gridSize + 1).fill(null));
    cellForbidden = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => new Set())
    );
    currentPlayer = 'X';
    gameOver = false;
  }

  function normalizeStateShape() {
    // cells
    const nextCells = Array.from({ length: gridSize }, (_, i) =>
      Array.from({ length: gridSize }, (_, j) =>
        (cellBoard[i] && typeof cellBoard[i][j] !== 'undefined') ? cellBoard[i][j] : null
      )
    );
    cellBoard = nextCells;

    // intersections
    const N = gridSize + 1;
    const nextInter = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (_, j) =>
        (interBoard[i] && typeof interBoard[i][j] !== 'undefined') ? interBoard[i][j] : null
      )
    );
    interBoard = nextInter;

    // forbidden
    const nextForbidden = Array.from({ length: gridSize }, (_, i) =>
      Array.from({ length: gridSize }, (_, j) => {
        const row = cellForbidden[i];
        const raw = row && row[j];
        if (raw instanceof Set) return raw;
        if (Array.isArray(raw)) return new Set(raw);
        return new Set();
      })
    );
    cellForbidden = nextForbidden;
  }

  function serializeState() {
    return {
      gridSize,
      winLength,
      currentPlayer,
      gameOver,
      cellBoard,
      interBoard,
      cellForbidden: cellForbidden.map((row) =>
        row.map((set) => Array.from(set))
      ),
    };
  }

  function applyState(state) {
    if (!state) return;
    gridSize = state.gridSize;
    winLength = state.winLength;
    currentPlayer = state.currentPlayer;
    gameOver = !!state.gameOver;
    cellBoard = state.cellBoard || [];
    interBoard = state.interBoard || [];
    cellForbidden = (state.cellForbidden || []).map((row) =>
      row.map((arr) => new Set(arr || []))
    );
    normalizeStateShape();
    inputGridSize.value = gridSize;
    inputWinLength.value = winLength;
    buildBoardDom();
    updateBoardView();
    if (gameOver) {
      if (checkWin()) {
        setStatusWinner();
      } else if (checkDraw()) {
        setStatusDraw();
      }
    }
  }

  function hasFirebase() {
    return !!window.firebaseRealtime;
  }

  function pushState() {
    if (!hasFirebase() || applyingSnapshot) return;
    const { db, ref, set } = window.firebaseRealtime;
    const state = serializeState();
    try {
      set(ref(db, `rooms/${ROOM_ID}`), state);
    } catch (e) {
      // ignore errors in prototype
    }
  }

  function listenState() {
    if (!hasFirebase()) return;
    const { db, ref, onValue } = window.firebaseRealtime;
    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    onValue(roomRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      applyingSnapshot = true;
      applyState(data);
      applyingSnapshot = false;
    });
  }

  /** Whether current player can place on cell (i, j) */
  function canPlaceCell(i, j) {
    if (cellBoard[i][j] !== null) return false;
    const f = cellForbidden[i][j];
    if (f.size === 2) return true; // overlapped forbidden zones → unlocked
    if (f.has(currentPlayer)) return false;
    return true;
  }

  /** Apply forbidden zones for opponent after placing on intersection */
  function applyForbiddenZones(ri, rj, player) {
    const opp = getOpponent(player);
    for (const [r, c] of getCellsAroundIntersection(ri, rj)) {
      cellForbidden[r][c].add(opp);
    }
  }

  /** Place on cell (i, j) */
  function placeCell(i, j) {
    if (gameOver || !canPlaceCell(i, j)) return;
    cellBoard[i][j] = currentPlayer;
    nextTurn();
    updateBoardView();
    pushState();
  }

  /** Place on intersection (ri, rj) */
  function placeIntersection(ri, rj) {
    if (gameOver || interBoard[ri][rj] !== null) return;
    interBoard[ri][rj] = currentPlayer;
    applyForbiddenZones(ri, rj, currentPlayer);
    nextTurn();
    updateBoardView();
    pushState();
  }

  function nextTurn() {
    if (checkWin()) {
      gameOver = true;
      setStatusWinner();
      return;
    }
    if (checkDraw()) {
      gameOver = true;
      setStatusDraw();
      return;
    }
    currentPlayer = getOpponent(currentPlayer);
    setStatusCurrent();
  }

  /** Check whether one line has winLength same marks */
  function checkLineLine(arr, len) {
    let count = 1;
    let last = arr[0];
    for (let k = 1; k < arr.length; k++) {
      if (arr[k] === last && last !== null) {
        count++;
        if (count >= len) return last;
      } else {
        count = 1;
        last = arr[k];
      }
    }
    return null;
  }

  function checkWin() {
    // Cell board: rows, columns, both diagonals
    for (let i = 0; i < gridSize; i++) {
      const row = cellBoard[i];
      const w = checkLineLine(row, winLength);
      if (w) return true;
    }
    for (let j = 0; j < gridSize; j++) {
      const col = cellBoard.map((row) => row[j]);
      const w = checkLineLine(col, winLength);
      if (w) return true;
    }
    for (let d = -(gridSize - 1); d <= gridSize - 1; d++) {
      const diag = [];
      for (let i = 0; i < gridSize; i++) {
        const j = i + d;
        if (j >= 0 && j < gridSize) diag.push(cellBoard[i][j]);
      }
      if (diag.length >= winLength && checkLineLine(diag, winLength)) return true;
    }
    for (let d = -(gridSize - 1); d <= gridSize - 1; d++) {
      const diag = [];
      for (let i = 0; i < gridSize; i++) {
        const j = gridSize - 1 - i + d;
        if (j >= 0 && j < gridSize) diag.push(cellBoard[i][j]);
      }
      if (diag.length >= winLength && checkLineLine(diag, winLength)) return true;
    }

    // Intersection board: rows, columns, both diagonals
    const N = gridSize + 1;
    for (let i = 0; i < N; i++) {
      const w = checkLineLine(interBoard[i], winLength);
      if (w) return true;
    }
    for (let j = 0; j < N; j++) {
      const col = interBoard.map((row) => row[j]);
      const w = checkLineLine(col, winLength);
      if (w) return true;
    }
    for (let d = -(N - 1); d <= N - 1; d++) {
      const diag = [];
      for (let i = 0; i < N; i++) {
        const j = i + d;
        if (j >= 0 && j < N) diag.push(interBoard[i][j]);
      }
      if (diag.length >= winLength && checkLineLine(diag, winLength)) return true;
    }
    for (let d = -(N - 1); d <= N - 1; d++) {
      const diag = [];
      for (let i = 0; i < N; i++) {
        const j = N - 1 - i + d;
        if (j >= 0 && j < N) diag.push(interBoard[i][j]);
      }
      if (diag.length >= winLength && checkLineLine(diag, winLength)) return true;
    }

    return false;
  }

  function checkDraw() {
    const cellFull = cellBoard.every((row) => row.every((v) => v !== null));
    const interFull = interBoard.every((row) => row.every((v) => v !== null));
    return cellFull && interFull;
  }

  function buildBoardDom() {
    const board = document.createElement('div');
    board.className = 'board';

    const table = document.createElement('table');
    for (let i = 0; i < gridSize; i++) {
      const tr = document.createElement('tr');
      for (let j = 0; j < gridSize; j++) {
        const td = document.createElement('td');
        td.className = 'cell';
        td.dataset.row = i;
        td.dataset.col = j;
        const val = cellBoard[i][j];
        if (val) {
          td.textContent = val;
          td.classList.add('taken', 'cell-' + val);
        } else {
          const forbidden = cellForbidden[i][j];
          if (forbidden.has('X')) td.classList.add('forbidden-x');
          if (forbidden.has('O')) td.classList.add('forbidden-o');
          if (forbidden.size === 2) td.classList.add('forbidden-overlap');
          if (forbidden.size === 1 && forbidden.has(currentPlayer)) td.classList.add('forbidden-current');
          td.addEventListener('click', () => placeCell(i, j));
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    board.appendChild(table);

    const interLayer = document.createElement('div');
    interLayer.className = 'intersections';
    interLayer.style.width = gridSize * CELL_SIZE + 24 + 'px';
    interLayer.style.height = gridSize * CELL_SIZE + 24 + 'px';

    const padding = 12;
    for (let ri = 0; ri < gridSize + 1; ri++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'inter-row';
      rowDiv.style.top = padding + ri * CELL_SIZE + 'px';
      for (let rj = 0; rj < gridSize + 1; rj++) {
        const cell = document.createElement('div');
        cell.className = 'inter-cell';
        cell.style.setProperty('--inter-left', padding + rj * CELL_SIZE + 'px');
        cell.dataset.ri = ri;
        cell.dataset.rj = rj;
        const val = interBoard[ri][rj];
        if (val) {
          cell.textContent = val;
          cell.classList.add('taken', 'inter-' + val);
        } else {
          cell.addEventListener('click', () => placeIntersection(ri, rj));
        }
        rowDiv.appendChild(cell);
      }
      interLayer.appendChild(rowDiv);
    }
    board.appendChild(interLayer);

    boardWrap.innerHTML = '';
    boardWrap.appendChild(board);
  }

  function renderBoard() {
    initState();
    buildBoardDom();
  }

  function updateBoardView() {
    const board = boardWrap.querySelector('.board');
    if (!board) return;

    const cells = board.querySelectorAll('.cell');
    cells.forEach((td) => {
      const i = parseInt(td.dataset.row, 10);
      const j = parseInt(td.dataset.col, 10);
      const val = cellBoard[i][j];
      td.textContent = val || '';
      td.classList.remove('cell-x', 'cell-o', 'taken', 'forbidden-x', 'forbidden-o', 'forbidden-overlap', 'forbidden-current');
      if (val) {
        td.classList.add('taken', 'cell-' + val);
      } else {
        const forbidden = cellForbidden[i][j];
        if (forbidden.has('X')) td.classList.add('forbidden-x');
        if (forbidden.has('O')) td.classList.add('forbidden-o');
        if (forbidden.size === 2) td.classList.add('forbidden-overlap');
        if (forbidden.size === 1 && forbidden.has(currentPlayer)) td.classList.add('forbidden-current');
      }
    });

    const interCells = board.querySelectorAll('.inter-cell');
    interCells.forEach((cell) => {
      const ri = parseInt(cell.dataset.ri, 10);
      const rj = parseInt(cell.dataset.rj, 10);
      const val = interBoard[ri][rj];
      cell.textContent = val || '';
      cell.classList.remove('inter-x', 'inter-o', 'taken');
      if (val) cell.classList.add('taken', 'inter-' + val);
    });

    if (!gameOver) {
      setStatusCurrent();
    }
  }

  function startNewGame() {
    gridSize = Math.max(3, Math.min(12, parseInt(inputGridSize.value, 10) || gridSize));
    winLength = Math.max(2, Math.min(Math.min(gridSize, gridSize + 1), parseInt(inputWinLength.value, 10) || winLength));
    inputGridSize.value = gridSize;
    inputWinLength.value = winLength;
    renderBoard();
    currentPlayer = 'X';
    setStatusCurrent();
    pushState();
  }

  function onCellClick(i, j) {
    placeCell(i, j);
    updateBoardView();
  }

  function onInterClick(ri, rj) {
    placeIntersection(ri, rj);
    updateBoardView();
  }

  btnNewGame.addEventListener('click', startNewGame);
  const btnLangEn = document.getElementById('btnLangEn');
  const btnLangZh = document.getElementById('btnLangZh');
  if (btnLangEn) {
    btnLangEn.addEventListener('click', () => {
      currentLang = 'en';
      applyStaticTexts();
      updateLangButtons();
      if (!gameOver) setStatusCurrent();
    });
  }
  if (btnLangZh) {
    btnLangZh.addEventListener('click', () => {
      currentLang = 'zh';
      applyStaticTexts();
      updateLangButtons();
      if (!gameOver) setStatusCurrent();
    });
  }
  inputGridSize.addEventListener('change', () => startNewGame());
  inputWinLength.addEventListener('change', () => startNewGame());

  applyStaticTexts();
  updateLangButtons();
  // initialize inputs from default state, then start the first game
  inputGridSize.value = gridSize;
  inputWinLength.value = winLength;
  startNewGame();

  window.onFirebaseReady = function () {
    listenState();
  };
})();
