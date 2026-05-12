"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
          color: "#999999",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>
            Something went wrong
          </h2>
          <button
            onClick={reset}
            style={{
              background: "#00ff88",
              color: "#0a0a0a",
              border: "none",
              borderRadius: "4px",
              padding: "8px 16px",
              fontSize: "13px",
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
