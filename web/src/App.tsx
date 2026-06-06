import { GameShell, GameTopbar } from "@freegamestore/games";

export default function App() {
  return (
    <GameShell topbar={<GameTopbar title="Blockudoku" score={0} />}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.5rem", color: "var(--ink)" }}>
        Game loading... if you see this, the SDK works!
      </div>
    </GameShell>
  );
}
