import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp";

type SupportedImage = { mimeType: ImageMimeType; extension: "jpg" | "png" | "webp" };

/**
 * Reconoce el formato por los primeros bytes del archivo y no por la extensión
 * ni por el `Content-Type` que manda el navegador: los dos los elige quien sube
 * el archivo. Solo se aceptan los tres formatos que cualquier navegador dibuja
 * sin plugins.
 */
export function detectImage(buffer: Buffer): SupportedImage | null {
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

export interface StoredImage {
  archivo: string;
  mimeType: ImageMimeType;
  tamanoBytes: number;
}

/**
 * Guarda imágenes subidas por el hotel dentro de una carpeta de `data/` — las
 * fotos de producto, los QR de las billeteras y el logo comparten validación,
 * límite de tamaño y nombres opacos. Vive bajo `data/` a propósito: es
 * contenido del cliente y tiene que sobrevivir a las actualizaciones igual que
 * la base de datos (ver installer/casacarlos.iss).
 */
export class ImageStorage {
  readonly root: string;

  constructor(dataDir: string, folder: string) {
    this.root = resolve(dataDir, folder);
    mkdirSync(this.root, { recursive: true });
  }

  save(buffer: Buffer): StoredImage {
    if (buffer.length === 0) throw new Error("La imagen está vacía.");
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error("La imagen supera el límite de 3 MB.");
    const detected = detectImage(buffer);
    if (!detected) throw new Error("Archivo inválido. Usa una imagen JPG, PNG o WebP real.");

    const archivo = `${randomUUID()}.${detected.extension}`;
    writeFileSync(resolve(this.root, archivo), buffer, { flag: "wx" });
    return { archivo, mimeType: detected.mimeType, tamanoBytes: buffer.length };
  }

  delete(archivo: string): void {
    // La metadata solo admite nombres opacos, pero se vuelve a reducir a
    // basename para impedir que una fila manipulada salga de la carpeta.
    const safeName = basename(archivo);
    if (safeName !== archivo) throw new Error("Nombre de imagen inválido.");
    const path = resolve(this.root, safeName);
    if (existsSync(path)) unlinkSync(path);
  }
}
