import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import QRCode from "qrcode";

const destination = "https://wedding.my-rem.com";
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
]);

console.log(`Generated wedding QR assets for ${destination}`);
