# InterCross-Toe

An H5-based twist on classic tic-tac-toe. Besides placing marks inside cells, players can also play on **grid intersections**, which create dynamic forbidden zones that can overlap and unlock.

> 中文说明请见 `README.zh-CN.md`。

## Core rules

- **Where to place**: You can place on
  - a **cell** (traditional tic-tac-toe), or
  - an **intersection** where grid lines cross.
- **Forbidden zones**: When you place on an intersection, the **4 surrounding cells** become forbidden **for your opponent**.
- **Overlapping unlock**: If both players’ forbidden zones cover the same cell, that cell is unlocked again and becomes playable for both players.
- **Winning**: On either the cell board or the intersection board, getting **K in a straight line** (row / column / diagonal) wins. Default: 5×5 grid, 3-in-a-row.

## Configurable prototype

- **Board size**: N×N cells, with (N+1)×(N+1) intersections (e.g. 5×5 gives 36 intersections).
- **Win length**: How many in a line count as a win (clamped to a sensible range based on the board size).

## Running locally

```bash
# From project root, pick one:
npx serve .
# or
python3 -m http.server 8765
```

Then open `http://localhost:8765` (or whatever port you used) and load `index.html`.

