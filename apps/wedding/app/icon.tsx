import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1d1b18", color: "#dcc08a", border: "16px solid #f6f2e9", fontFamily: "Georgia", fontSize: 124, letterSpacing: -10 }}>
      S<span style={{ fontSize: 70, margin: "0 20px", fontStyle: "italic" }}>&amp;</span>M
    </div>,
    size,
  );
}
