"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, background: "#f6f2e9", color: "#1d1b18", fontFamily: "Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 64, color: "#a9854f", margin: 0 }} dir="ltr">S &amp; M</p>
            <h1>משהו קטן השתבש</h1>
            <p>רעננו את העמוד או נסו שוב בעוד רגע ❤️</p>
            <button onClick={reset} style={{ border: 0, borderRadius: 999, background: "#1d1b18", color: "white", padding: "14px 24px", fontWeight: 700 }}>ניסיון נוסף</button>
          </div>
        </main>
      </body>
    </html>
  );
}
