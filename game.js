/**
 * InterCross-Toe 游戏逻辑
 * - 可在格子或交叉处落子
 * - 交叉处落子后，对手在该交叉四格内为禁区；禁区重叠则重叠格解禁
 * - 支持自定义棋盘大小与连子数
 */

(function () {
  const CELL_SIZE = 44;

  let gridSize = 5;
  let winLength = 3;
  let currentPlayer = 'X';

  // 格子棋盘: gridSize x gridSize, 值为 null | 'X' | 'O'
  let cellBoard = [];
  // 交叉点棋盘: (gridSize+1) x (gridSize+1)
  let interBoard = [];
  // 每个格子的禁区标记: cellForbidden[i][j] = Set of 'X'|'O'，表示被谁禁了；size===2 表示重叠解禁
  let cellForbidden = [];
  let gameOver = false;

  const boardWrap = document.getElementById('boardWrap');
  const gameStatus = document.getElementById('gameStatus');
  const inputGridSize = document.getElementById('gridSize');
  const inputWinLength = document.getElementById('winLength');
  const btnNewGame = document.getElementById('btnNewGame');

  function getOpponent(p) {
    return p === 'X' ? 'O' : 'X';
  }

  /** 交叉点 (ri, rj) 对应的四个格子（在边界内的） */
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

  /** 当前玩家是否可以在格子 (i, j) 落子 */
  function canPlaceCell(i, j) {
    if (cellBoard[i][j] !== null) return false;
    const f = cellForbidden[i][j];
    if (f.size === 2) return true; // 重叠解禁
    if (f.has(currentPlayer)) return false;
    return true;
  }

  /** 在交叉点落子后，更新四格禁区（对手被禁） */
  function applyForbiddenZones(ri, rj, player) {
    const opp = getOpponent(player);
    for (const [r, c] of getCellsAroundIntersection(ri, rj)) {
      cellForbidden[r][c].add(opp);
    }
  }

  /** 在格子 (i, j) 落子 */
  function placeCell(i, j) {
    if (gameOver || !canPlaceCell(i, j)) return;
    cellBoard[i][j] = currentPlayer;
    nextTurn();
    updateBoardView();
  }

  /** 在交叉点 (ri, rj) 落子 */
  function placeIntersection(ri, rj) {
    if (gameOver || interBoard[ri][rj] !== null) return;
    interBoard[ri][rj] = currentPlayer;
    applyForbiddenZones(ri, rj, currentPlayer);
    nextTurn();
    updateBoardView();
  }

  function nextTurn() {
    if (checkWin()) {
      gameOver = true;
      gameStatus.textContent = `获胜：${currentPlayer}`;
      return;
    }
    if (checkDraw()) {
      gameOver = true;
      gameStatus.textContent = '平局';
      return;
    }
    currentPlayer = getOpponent(currentPlayer);
    gameStatus.textContent = `当前：${currentPlayer}`;
  }

  /** 检查某条线是否由同一玩家在格子或交叉点上连成 winLength 子 */
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
    // 格子棋盘：行、列、两条对角线方向
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

    // 交叉点棋盘：行、列、两条对角线
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

  function renderBoard() {
    initState();

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
      gameStatus.textContent = `当前：${currentPlayer}`;
    }
  }

  function startNewGame() {
    gridSize = Math.max(3, Math.min(12, parseInt(inputGridSize.value, 10) || 5));
    winLength = Math.max(2, Math.min(Math.min(gridSize, gridSize + 1), parseInt(inputWinLength.value, 10) || 3));
    inputGridSize.value = gridSize;
    inputWinLength.value = winLength;
    renderBoard();
    gameStatus.textContent = '当前：X';
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
  inputGridSize.addEventListener('change', () => startNewGame());
  inputWinLength.addEventListener('change', () => startNewGame());

  startNewGame();
})();
