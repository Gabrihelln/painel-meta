import { ImageResponse } from "next/og";

// Ícone para quem salvar o painel na tela inicial do celular (iPhone/iPad).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#1d1d1b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 124, height: 124, borderRadius: 62, border: "11px solid rgba(29,158,117,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{ width: 78, height: 78, borderRadius: 39, background: "#1D9E75" }} />
        </div>
      </div>
    ),
    size,
  );
}
