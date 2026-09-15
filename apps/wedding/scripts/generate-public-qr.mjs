import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import QRCode from "qrcode";

const destination = (process.env.NEXT_PUBLIC_SITE_URL || "https://wedding.my-rem.com").replace(/\/$/, "");
const shareDestination = `${destination}/share`;
const outputDirectory = resolve("public/qr");

await mkdir(outputDirectory, { recursive: true });

const options = {
  errorCorrectionLevel: "H",
  margin: 4,
  color: {
    dark: "#1D1B18",
    light: "#FFFDF8",
  },
};

await Promise.all([
  QRCode.toFile(resolve(outputDirectory, "wedding-site.png"), destination, {
    ...options,
    type: "png",
    width: 2000,
  }),
  QRCode.toFile(resolve(outputDirectory, "wedding-site.svg"), destination, {
    ...options,
    type: "svg",
    width: 2000,
  }),
  QRCode.toFile(resolve(outputDirectory, "live-wall-share.png"), shareDestination, {
    ...options,
    type: "png",
    width: 1200,
  }),
  QRCode.toFile(resolve(outputDirectory, "live-wall-share.svg"), shareDestination, {
    ...options,
    type: "svg",
    width: 1200,
  }),
]);

console.log(`Generated wedding QR assets for ${destination} and ${shareDestination}`);
