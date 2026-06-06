import { useState, useCallback, useRef, useEffect } from "react";
import {
  GameShell,
  GameTopbar,
  GameOverScreen,
  GameButton,
  useGameSounds,
} from "@freegamestore/games";

// --- Types ---
type Cell = 0 | 1;
type Grid = Cell[][];
type Shape = [number, number][]; // [row, col] offsets
type Piece = { shape: Shape; color: string };

// --- Constants ---
const SIZE = 9;
const BOX = 3;
const COLORS = [
  "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#10b981",
  "#ec4899", "#06b6d4", "#f97316",
];

// --- Shape definitions ---
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
  [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]],
  [[0,0],[0,1],[0,2],[1,1],[2,0],[2,1],[2,2]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]],
];

function randomPiece(): Piece {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return { shape, color };
}

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0) as Cell[]);
}

function canPlace(grid: Grid, shape: Shape, row: number, col: number): boolean {
  for (const [dr, dc] of shape) {
    const r = row + dr, c = col + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || grid[r][c] !== 0) return false;
  }
  return true;
}

function placeShape(grid: Grid, shape: Shape, row: number, col: number): Grid {
  const g = grid.map((r) => [...r]);
  for (const [dr, dc] of shape) g[row + dr][col + dc] = 1;
  return g;
}

function findClears(grid: Grid): Set<string> {
  const toClear = new Set<string>();
  // Rows
  for (let r = 0; r < SIZE; r++) {
    if (grid[r].every((c) => c === 1)) {
      for (let c = 0; c < SIZE; c++) toClear.add(`${r},${c}`);
    }
  }
  // Columns
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) { if (grid[r][c] === 0) { full = false; break; } }
    if (full) for (let r = 0; r < SIZE; r++) toClear.add(`${r},${c}`);
  }
  // 3x3 boxes
  for (let br = 0; br < SIZE; br += BOX) {
    for (let bc = 0; bc < SIZE; bc += BOX) {
      let full = true;
      for (let r = br; r < br + BOX; r++)
        for (let c = bc; c < bc + BOX; c++)
          if (grid[r][c] === 0) full = false;
      if (full)
        for (let r = br; r < br + BOX; r++)
          for (let c = bc; c < bc + BOX; c++) toClear.add(`${r},${c}`);
    }
  }
  return toClear;
}

function clearCells(grid: Grid, cells: Set<string>): Grid {
  const g = grid.map((r) => [...r]);
  for (const key of cells) {
    const [r, c] = key.split(",").map(Number);
    g[r][c] = 0;
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

// --- Piece preview component ---
function PiecePreview({
  piece, index, dragging, onDragStart,
}: {
  piece: Piece | null;
  index: number;
  dragging: number | null;
  onDragStart: (idx: number, e: React.PointerEvent) => void;
}) {
  if (!piece) return <div className="w-20 h-20" />;
  const rows = Math.max(...piece.shape.map(([r]) => r)) + 1;
  const cols = Math.max(...piece.shape.map(([, c]) => c)) + 1;
  const cellSize = Math.min(18, 72 / Math.max(rows, cols));
  const occupied = new Set(piece.shape.map(([r, c]) => `${r},${c}`));
  const isDragging = dragging === index;

  return (
    <div
      className="flex items-center justify-center w-20 h-20 cursor-grab active:cursor-grabbing rounded-lg"
      style={{
        opacity: isDragging ? 0.3 : 1,
        background: "var(--line)",
        touchAction: "none",
      }}
      onPointerDown={(e) => onDragStart(index, e)}
    >
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`, gap: "2px" }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          return (
            <div
              key={i}
              style={{
                width: cellSize, height: cellSize, borderRadius: 3,
                background: occupied.has(`${r},${c}`) ? piece.color : "transparent",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Main App ---
export default function App() {
  const sounds = useGameSounds();
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [pieces, setPieces] = useState<(Piece | null)[]>(() => [randomPiece(), randomPiece(), randomPiece()]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try { return parseInt(localStorage.getItem("blockudoku-best") ?? "0"); } catch { return 0; }
  });
  const [gameOver, setGameOver] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [ghostPos, setGhostPos] = useState<{ row: number; col: number } | null>(null);
  const [clearing, setClearing] = useState<Set<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const cellSize = useRef(0);

  const getCellFromPoint = useCallback((x: number, y: number): { row: number; col: number } | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const gap = 2;
    const totalGap = (SIZE - 1) * gap;
    const cs = (rect.width - totalGap) / SIZE;
    cellSize.current = cs;
    const col = Math.floor((x - rect.left) / (cs + gap));
    const row = Math.floor((y - rect.top) / (cs + gap));
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    return { row, col };
  }, []);

  const handleDragStart = useCallback((idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(idx);
    dragOffset.current = { dx: 0, dy: 0 };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging === null) return;
    // Offset the drop point up and left so the piece appears where the finger is
    const pos = getCellFromPoint(e.clientX - 20, e.clientY - 60);
    setGhostPos(pos);
  }, [dragging, getCellFromPoint]);

  const handlePointerUp = useCallback(() => {
    if (dragging === null) return;
    const piece = pieces[dragging];
    if (piece && ghostPos && canPlace(grid, piece.shape, ghostPos.row, ghostPos.col)) {
      let newGrid = placeShape(grid, piece.shape, ghostPos.row, ghostPos.col);
      sounds.playDrop();

      const clears = findClears(newGrid);
      const newPieces = [...pieces];
      newPieces[dragging] = null;

      // Refill tray if all placed
      const allUsed = newPieces.every((p) => p === null);
      const nextPieces = allUsed ? [randomPiece(), randomPiece(), randomPiece()] : newPieces;

      if (clears.size > 0) {
        setClearing(clears);
        const linesCleared = Math.ceil(clears.size / SIZE);
        const bonus = linesCleared > 1 ? linesCleared * 28 : 0;
        const pts = clears.size + bonus;
        sounds.playClear();

        setTimeout(() => {
          newGrid = clearCells(newGrid, clears);
          setGrid(newGrid);
          setClearing(new Set());
          setScore((s) => {
            const next = s + pts;
            if (next > best) {
              setBest(next);
              try { localStorage.setItem("blockudoku-best", String(next)); } catch {}
            }
            return next;
          });
          setPieces(nextPieces);
          if (!canFitAny(newGrid, nextPieces)) {
            sounds.playGameOver();
            setGameOver(true);
          }
        }, 300);
      } else {
        setGrid(newGrid);
        setScore((s) => {
          const next = s + piece.shape.length;
          if (next > best) {
            setBest(next);
            try { localStorage.setItem("blockudoku-best", String(next)); } catch {}
          }
          return next;
        });
        setPieces(nextPieces);
        if (!canFitAny(newGrid, nextPieces)) {
          sounds.playGameOver();
          setGameOver(true);
        }
      }
    } else if (dragging !== null && ghostPos) {
      sounds.playError();
    }
    setDragging(null);
    setGhostPos(null);
  }, [dragging, ghostPos, grid, pieces, sounds, best]);

  const restart = useCallback(() => {
    setGrid(emptyGrid());
    setPieces([randomPiece(), randomPiece(), randomPiece()]);
    setScore(0);
    setGameOver(false);
    setClearing(new Set());
  }, []);

  // Ghost validity
  const piece = dragging !== null ? pieces[dragging] : null;
  const ghostValid = piece && ghostPos ? canPlace(grid, piece.shape, ghostPos.row, ghostPos.col) : false;
  const ghostCells = new Set<string>();
  if (piece && ghostPos && ghostValid) {
    for (const [dr, dc] of piece.shape) ghostCells.add(`${ghostPos.row + dr},${ghostPos.col + dc}`);
  }

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Blockudoku"
          stats={[
            { label: "SCORE", value: score, accent: true },
            { label: "BEST", value: best },
          ]}
          onRestart={restart}
        />
      }
    >
      <div
        className="flex flex-col items-center justify-center h-full gap-4 select-none"
        style={{ touchAction: "none" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Board */}
        <div
          ref={boardRef}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
            gap: "2px",
            width: "min(85vw, 85vh - 160px, 400px)",
            aspectRatio: "1",
            background: "var(--line)",
            borderRadius: "var(--radius)",
            padding: "4px",
          }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const r = Math.floor(i / SIZE), c = i % SIZE;
            const key = `${r},${c}`;
            const filled = grid[r][c] === 1;
            const isGhost = ghostCells.has(key);
            const isClearing = clearing.has(key);
            const boxR = Math.floor(r / BOX), boxC = Math.floor(c / BOX);
            const darkBox = (boxR + boxC) % 2 === 0;

            return (
              <div
                key={i}
                style={{
                  borderRadius: 4,
                  background: isClearing
                    ? "#fbbf24"
                    : filled
                    ? "var(--accent)"
                    : isGhost
                    ? piece ? `${piece.color}66` : "var(--accent)33"
                    : darkBox
                    ? "var(--paper)"
                    : "color-mix(in srgb, var(--paper) 85%, var(--muted))",
                  transition: isClearing ? "background 0.2s" : "none",
                }}
              />
            );
          })}
        </div>

        {/* Piece tray */}
        <div className="flex gap-3 justify-center">
          {pieces.map((p, i) => (
            <PiecePreview
              key={i}
              piece={p}
              index={i}
              dragging={dragging}
              onDragStart={handleDragStart}
            />
          ))}
        </div>

        {gameOver && (
          <GameOverScreen score={score} highScore={best} onPlayAgain={restart} />
        )}
      </div>
    </GameShell>
  );
}
