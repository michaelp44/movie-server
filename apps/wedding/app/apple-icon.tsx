import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1d1b18", color: "#dcc08a", borderRadius: 38, fontFamily: "Georgia", fontSize: 48 }}>
      S <span style={{ fontSize: 30, margin: "0 8px", fontStyle: "italic" }}>&amp;</span> M
    </div>,
    size,
  );
}
