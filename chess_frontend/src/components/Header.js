import React from "react";

/**
 * Header component for global app navigation and controls.
 * Kept intentionally simple (no router dependency).
 */
// PUBLIC_INTERFACE
export default function Header({ theme, onToggleTheme, canGoBack, onBack, onGoOnline }) {
  return (
    <header className="Header">
      <div className="HeaderInner">
        <div className="Brand" aria-label="Neon Violet Chess">
          <h1 className="BrandTitle">Neon Violet Chess</h1>
          <p className="BrandTagline">Local • AI • Online (WebSocket)</p>
        </div>

        <div className="HeaderActions">
          {canGoBack && (
            <button className="NVButton NVButtonSecondary" onClick={onBack} type="button">
              Back
            </button>
          )}

          <button className="NVButton NVButtonSecondary" onClick={onGoOnline} type="button">
            Online
          </button>

          <button
            className="NVButton"
            onClick={onToggleTheme}
            type="button"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            Theme: {theme === "light" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
