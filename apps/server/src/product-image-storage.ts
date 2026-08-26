import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { ProductImage } from "@casacarlos/contracts";

export const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024;

type SupportedImage = { mimeType: ProductImage["mimeType"]; extension: "jpg" | "png" | "webp" };

function detectImage(buffer: Buffer): SupportedImage | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

export class ProductImageStorage {
  readonly root: string;

  constructor(dataDir: string) {
    this.root = resolve(dataDir, "product-images");
    mkdirSync(this.root, { recursive: true });
  }

  save(buffer: Buffer): { archivo: string; mimeType: ProductImage["mimeType"]; tamanoBytes: number } {
    if (buffer.length === 0) throw new Error("La imagen está vacía.");
    if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) throw new Error("La imagen supera el límite de 3 MB.");
    const detected = detectImage(buffer);
    if (!detected) throw new Error("Archivo inválido. Usa una imagen JPG, PNG o WebP real.");

    const archivo = `${randomUUID()}.${detected.extension}`;
    writeFileSync(resolve(this.root, archivo), buffer, { flag: "wx" });
    return { archivo, mimeType: detected.mimeType, tamanoBytes: buffer.length };
  }

  delete(archivo: string): void {
    // La metadata solo admite nombres opacos, pero se vuelve a reducir a
    // basename para impedir que una fila manipulada salga de product-images.
    const safeName = basename(archivo);
    if (safeName !== archivo) throw new Error("Nombre de imagen inválido.");
    const path = resolve(this.root, safeName);
    if (existsSync(path)) unlinkSync(path);
  }
}
