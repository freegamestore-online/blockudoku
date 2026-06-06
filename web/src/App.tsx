import { useState, useCallback, useRef } from "react";
import {
  GameShell,
  GameTopbar,
  GameOverScreen,
  useGameSounds,
} from "@freegamestore/games";

type Cell = 0 | 1;
type Grid = Cell[][];
type Shape = [number, number][];
interface Piece { shape: Shape; color: string }

const SIZE = 9;
const BOX = 3;
const COLORS = ["#3b82f6","#8b5cf6","#ef4444","#f59e0b","#10b981","#ec4899","#06b6d4","#f97316"];

const SHAPES: Shape[] = [
  [[0,0]],
  [[0,0],[0,1]],
  [[0,0],[1,0]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[1,0]],
  [[0,0],[0,1],[1,1]],
  [[0,0],[1,0],[1,1]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[0,2],[1,0]],
  [[0,0],[0,1],[0,2],[1,2]],
  [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[0,1],[1,0],[2,0]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]],
];

function randomPiece(): Piece {
  return {
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)]!,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
  };
}

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => new Array<Cell>(SIZE).fill(0));
}

function canPlace(grid: Grid, shape: Shape, row: number, col: number): boolean {
  for (const [dr, dc] of shape) {
    const r = row + dr, c = col + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (grid[r]?.[c] !== 0) return false;
  }
  return true;
}

function placeShape(grid: Grid, shape: Shape, row: number, col: number): Grid {
  const g = grid.map(r => [...r]);
  for (const [dr, dc] of shape) {
    const nr = row + dr, nc = col + dc;
    if (g[nr]) g[nr][nc] = 1;
  }
  return g;
}

function findClears(grid: Grid): Set<string> {
  const toClear = new Set<string>();
  for (let r = 0; r < SIZE; r++) {
    if (grid[r]?.every(c => c === 1)) {
      for (let c = 0; c < SIZE; c++) toClear.add(`${r},${c}`);
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) { if (grid[r]?.[c] !== 1) { full = false; break; } }
    if (full) for (let r = 0; r < SIZE; r++) toClear.add(`${r},${c}`);
  }
  for (let br = 0; br < SIZE; br += BOX) {
    for (let bc = 0; bc < SIZE; bc += BOX) {
      let full = true;
      for (let r = br; r < br + BOX; r++)
        for (let c = bc; c < bc + BOX; c++)
          if (grid[r]?.[c] !== 1) full = false;
      if (full)
        for (let r = br; r < br + BOX; r++)
          for (let c = bc; c < bc + BOX; c++) toClear.add(`${r},${c}`);
    }
  }
  return toClear;
}

/** Count distinct lines cleared (rows + cols + boxes). */
function countLines(grid: Grid, cells: Set<string>): number {
  let lines = 0;
  for (let r = 0; r < SIZE; r++) {
    let full = true;
    for (let c = 0; c < SIZE; c++) if (!cells.has(`${r},${c}`)) { full = false; break; }
    if (full) lines++;
  }
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) if (!cells.has(`${r},${c}`)) { full = false; break; }
    if (full) lines++;
  }
  for (let br = 0; br < SIZE; br += BOX) {
    for (let bc = 0; bc < SIZE; bc += BOX) {
      let full = true;
      for (let r = br; r < br + BOX; r++)
        for (let c = bc; c < bc + BOX; c++)
          if (!cells.has(`${r},${c}`)) { full = false; break; }
      if (full) lines++;
    }
  }
  return lines;
}

function clearCells(grid: Grid, cells: Set<string>): Grid {
  const g = grid.map(r => [...r]);
  for (const key of cells) {
    const [rs, cs] = key.split(",");
    const r = Number(rs), c = Number(cs);
    if (g[r]) g[r][c] = 0;
  }
  return g;
}

function canFitAny(grid: Grid, pieces: (Piece | null)[]): boolean {
  for (const p of pieces) {
    if (!p) continue;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (canPlace(grid, p.shape, r, c)) return true;
  }
  return false;
}

function PiecePreview({ piece, index, dragging, onDragStart }: {
  piece: Piece | null; index: number; dragging: number | null;
  onDragStart: (idx: number, e: React.PointerEvent) => void;
}) {
  if (!piece) return <div style={{ width: 80, height: 80 }} />;
  const rows = Math.max(...piece.shape.map(s => s[0])) + 1;
  const cols = Math.max(...piece.shape.map(s => s[1])) + 1;
  const cs = Math.min(18, 72 / Math.max(rows, cols));
  const occupied = new Set(piece.shape.map(s => `${s[0]},${s[1]}`));
  return (
    <div
      style={{ display: "flex", alignItems: "center", justifyContent: "center",
        width: 80, height: 80, cursor: "grab", borderRadius: 8,
        opacity: dragging === index ? 0.3 : 1, background: "var(--line)", touchAction: "none" }}
      onPointerDown={e => onDragStart(index, e)}
    >
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cs}px)`, gap: "2px" }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          return <div key={i} style={{ width: cs, height: cs, borderRadius: 3,
            background: occupied.has(`${r},${c}`) ? piece.color : "transparent" }} />;
        })}
      </div>
    </div>
  );
}

const BOARD_PAD = 4;

/** Inner game board — rendered inside GameShell so useGameSounds gets SoundProvider context. */
function GameBoard({ score, setScore, best, setBest, grid, setGrid,
  pieces, setPieces, gameOver, setGameOver }: {
  score: number; setScore: React.Dispatch<React.SetStateAction<number>>;
  best: number; setBest: React.Dispatch<React.SetStateAction<number>>;
  grid: Grid; setGrid: React.Dispatch<React.SetStateAction<Grid>>;
  pieces: (Piece | null)[]; setPieces: React.Dispatch<React.SetStateAction<(Piece | null)[]>>;
  gameOver: boolean; setGameOver: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const sounds = useGameSounds();
  const [dragging, setDragging] = useState<number | null>(null);
  const [ghostPos, setGhostPos] = useState<{ row: number; col: number } | null>(null);
  const [clearing, setClearing] = useState<Set<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);

  const getCellFromPoint = useCallback((x: number, y: number) => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const innerW = rect.width - BOARD_PAD * 2;
    const innerH = rect.height - BOARD_PAD * 2;
    const gap = 2;
    const csW = (innerW - (SIZE - 1) * gap) / SIZE;
    const csH = (innerH - (SIZE - 1) * gap) / SIZE;
    const col = Math.floor((x - rect.left - BOARD_PAD) / (csW + gap));
    const row = Math.floor((y - rect.top - BOARD_PAD) / (csH + gap));
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    return { row, col };
  }, []);

  const handleDragStart = useCallback((idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(idx);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging === null) return;
    const p = pieces[dragging];
    if (!p) return;
    // Offset: center the piece shape on the pointer, shift up so finger doesn't cover it
    const shapeRows = Math.max(...p.shape.map(s => s[0])) + 1;
    const shapeCols = Math.max(...p.shape.map(s => s[1])) + 1;
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const cs = (rect.width - BOARD_PAD * 2 - (SIZE - 1) * 2) / SIZE;
    const offsetX = Math.floor(shapeCols / 2) * (cs + 2);
    const offsetY = Math.floor(shapeRows / 2) * (cs + 2) + 40; // +40 so finger doesn't cover
    setGhostPos(getCellFromPoint(e.clientX - offsetX, e.clientY - offsetY));
  }, [dragging, pieces, getCellFromPoint]);

  const handlePointerUp = useCallback(() => {
    if (dragging === null) return;
    const piece = pieces[dragging] ?? null;
    if (piece && ghostPos && canPlace(grid, piece.shape, ghostPos.row, ghostPos.col)) {
      let newGrid = placeShape(grid, piece.shape, ghostPos.row, ghostPos.col);
      sounds.playDrop();
      const clears = findClears(newGrid);
      const newPieces = [...pieces];
      newPieces[dragging] = null;
      const allUsed = newPieces.every(p => p === null);
      const nextPieces = allUsed ? [randomPiece(), randomPiece(), randomPiece()] : newPieces;
      if (clears.size > 0) {
        setClearing(clears);
        const lines = countLines(newGrid, clears);
        // 18 per cell cleared + 10 bonus per extra line (combo)
        const pts = clears.size + Math.max(0, lines - 1) * 18;
        sounds.playClear();
        setTimeout(() => {
          newGrid = clearCells(newGrid, clears);
          setGrid(newGrid);
          setClearing(new Set());
          setScore(s => { const n = s + pts; if (n > best) { setBest(n); try { localStorage.setItem("blockudoku-best", String(n)); } catch {} } return n; });
          setPieces(nextPieces);
          if (!canFitAny(newGrid, nextPieces)) { sounds.playGameOver(); setGameOver(true); }
        }, 300);
      } else {
        setGrid(newGrid);
        setScore(s => { const n = s + piece.shape.length; if (n > best) { setBest(n); try { localStorage.setItem("blockudoku-best", String(n)); } catch {} } return n; });
        setPieces(nextPieces);
        if (!canFitAny(newGrid, nextPieces)) { sounds.playGameOver(); setGameOver(true); }
      }
    } else if (ghostPos) {
      sounds.playError();
    }
    setDragging(null);
    setGhostPos(null);
  }, [dragging, ghostPos, grid, pieces, sounds, best, setGrid, setScore, setBest, setPieces, setGameOver]);

  const piece = dragging !== null ? (pieces[dragging] ?? null) : null;
  const ghostValid = piece && ghostPos ? canPlace(grid, piece.shape, ghostPos.row, ghostPos.col) : false;
  const ghostCells = new Set<string>();
  if (piece && ghostPos && ghostValid) {
    for (const [dr, dc] of piece.shape) ghostCells.add(`${ghostPos.row + dr},${ghostPos.col + dc}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", gap: 16, userSelect: "none", touchAction: "none" }}
      onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>

      <div ref={boardRef} style={{ display: "grid", gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)`, gap: 2,
        width: "min(85vw, calc(85vh - 160px), 400px)", aspectRatio: "1", background: "var(--line)",
        borderRadius: "var(--radius)", padding: BOARD_PAD }}>
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const r = Math.floor(i / SIZE), c = i % SIZE;
          const k = `${r},${c}`;
          const filled = grid[r]?.[c] === 1;
          const isGhost = ghostCells.has(k);
          const isClearing = clearing.has(k);
          const darkBox = (Math.floor(r / BOX) + Math.floor(c / BOX)) % 2 === 0;
          return <div key={i} style={{ borderRadius: 4,
            background: isClearing ? "#fbbf24" : filled ? "var(--accent)"
              : isGhost ? (piece ? piece.color + "66" : "var(--accent)33")
              : darkBox ? "var(--paper)" : "color-mix(in srgb, var(--paper) 85%, var(--muted))",
            transition: isClearing ? "background 0.2s" : "none" }} />;
        })}
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        {pieces.map((p, i) => <PiecePreview key={i} piece={p} index={i} dragging={dragging} onDragStart={handleDragStart} />)}
      </div>

      {gameOver && <GameOverScreen score={score} highScore={best} onPlayAgain={() => {
        setGrid(emptyGrid());
        setPieces([randomPiece(), randomPiece(), randomPiece()]);
        setScore(0);
        setGameOver(false);
        setClearing(new Set());
      }} />}
    </div>
  );
}

export default function App() {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [pieces, setPieces] = useState<(Piece | null)[]>(() => [randomPiece(), randomPiece(), randomPiece()]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try { return parseInt(localStorage.getItem("blockudoku-best") ?? "0"); } catch { return 0; }
  });
  const [gameOver, setGameOver] = useState(false);

  const restart = useCallback(() => {
    setGrid(emptyGrid());
    setPieces([randomPiece(), randomPiece(), randomPiece()]);
    setScore(0);
    setGameOver(false);
  }, []);

  return (
    <GameShell topbar={<GameTopbar title="Blockudoku" stats={[{ label: "SCORE", value: score, accent: true }, { label: "BEST", value: best }]} onRestart={restart} />}>
      <GameBoard score={score} setScore={setScore} best={best} setBest={setBest}
        grid={grid} setGrid={setGrid} pieces={pieces} setPieces={setPieces}
        gameOver={gameOver} setGameOver={setGameOver} />
    </GameShell>
  );
}
