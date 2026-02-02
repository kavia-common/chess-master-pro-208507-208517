import React, { useMemo, useState } from "react";
import "./App.css";

import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import GamePage from "./pages/GamePage";
import OnlinePage from "./pages/OnlinePage";
import { ToastProvider } from "./hooks/useToast";
import { useLocalStorageState } from "./hooks/useLocalStorageState";

/**
 * Application screens for lightweight navigation without adding a router dependency.
 */
const SCREENS = Object.freeze({
  HOME: "HOME",
  GAME: "GAME",
  ONLINE: "ONLINE",
});

// PUBLIC_INTERFACE
function App() {
  /** Persist theme locally for a consistent retro experience. */
  const [theme, setTheme] = useLocalStorageState("nvchess.theme", "light");

  /** Which top-level screen is currently visible. */
  const [screen, setScreen] = useState(SCREENS.HOME);

  /** Game configuration for the active game screen. */
  const [gameConfig, setGameConfig] = useState({
    mode: "LOCAL", // LOCAL | AI | ONLINE
    aiDepth: 2,
    playerPlays: "w", // for AI mode: 'w' or 'b'
    initialMinutes: 5,
    incrementSeconds: 0,
    room: null, // for ONLINE mode: { roomCode, side }
  });

  const appClassName = useMemo(() => {
    return `App theme-${theme}`;
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const goHome = () => setScreen(SCREENS.HOME);

  const startGame = (nextConfig) => {
    setGameConfig(nextConfig);
    setScreen(SCREENS.GAME);
  };

  const openOnline = () => setScreen(SCREENS.ONLINE);

  const onEnterRoom = ({ roomCode, side, initialMinutes, incrementSeconds }) => {
    setGameConfig({
      mode: "ONLINE",
      aiDepth: 0,
      playerPlays: side,
      initialMinutes,
      incrementSeconds,
      room: { roomCode, side },
    });
    setScreen(SCREENS.GAME);
  };

  return (
    <ToastProvider>
      <div className={appClassName}>
        <Header
          theme={theme}
          onToggleTheme={toggleTheme}
          canGoBack={screen !== SCREENS.HOME}
          onBack={goHome}
          onGoOnline={openOnline}
        />

        <main className="Main">
          {screen === SCREENS.HOME && (
            <HomePage onStartGame={startGame} onGoOnline={openOnline} />
          )}

          {screen === SCREENS.ONLINE && (
            <OnlinePage onBack={goHome} onEnterRoom={onEnterRoom} />
          )}

          {screen === SCREENS.GAME && (
            <GamePage config={gameConfig} onExit={goHome} />
          )}
        </main>

        <Footer />
      </div>
    </ToastProvider>
  );
}

export default App;
