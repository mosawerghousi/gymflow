"use client";

/**
 * The last resort: an error in the root layout itself, where no theme, font or
 * provider is available. Deliberately dependency-free and inline-styled.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#12161d",
          color: "#f5f7fa",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <p style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Gym<span style={{ color: "#34d399" }}>Flow</span> could not start {/* i18n-ignore — brand wordmark */}
          </p>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: "0 0 1.5rem" }}>
            Something failed before the app could render.
            {error.digest ? ` Ref: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#10b981",
              color: "#0b1220",
              border: 0,
              borderRadius: 8,
              padding: "0.55rem 1.1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
