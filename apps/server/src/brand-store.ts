import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Brand } from "@casacarlos/contracts";
import { ImageStorage, detectImage, type ImageMimeType } from "./image-storage.js";

const DEFAULT_NOMBRE = "Hospedaje Carlos";
const DEFAULT_LEMA = "Sistema de hospedaje";

interface BrandFile {
  nombre?: string;
  lema?: string | null;
  logoArchivo?: string | null;
  logoMimeType?: ImageMimeType | null;
  actualizadoEn?: string | null;
}

/**
 * Nombre y logo que el hotel ve en recepción, en el kiosco y en los
 * comprobantes impresos. Vive en `data/` (un `brand/brand.json` + el archivo
 * del logo en `brand-images/`) y NO en la base de datos, por una razón concreta: el instalador
 * pide el logo durante la primera instalación, y desde Inno Setup se puede
 * copiar un archivo y escribir un JSON, pero no insertar una fila en SQLite.
 * Al estar bajo `data/` sobrevive a las actualizaciones igual que la base.
 */
export class BrandStore {
  private readonly dir: string;
  private readonly filePath: string;
  private readonly images: ImageStorage;

  constructor(dataDir: string) {
    this.dir = resolve(dataDir, "brand");
    mkdirSync(this.dir, { recursive: true });
    this.filePath = resolve(this.dir, "brand.json");
    // El archivo del logo vive en una carpeta aparte de brand.json porque esa
    // carpeta se sirve entera por HTTP (/brand-images/): así se publica el
    // logo y nada más.
    this.images = new ImageStorage(dataDir, "brand-images");
  }

  /** Carpeta que se sirve estáticamente en /brand-images/. */
  get root(): string {
    return this.images.root;
  }

  read(): Brand {
    const file = this.readFile();
    const logo = this.validLogo(file);
    return {
      nombre: file.nombre?.trim() || DEFAULT_NOMBRE,
      lema: file.lema?.trim() ? file.lema.trim() : DEFAULT_LEMA,
      logoUrl: logo ? `/brand-images/${encodeURIComponent(logo)}` : null,
    };
  }

  setNombre(nombre: string, lema: string | null): Brand {
    const limpio = nombre.trim();
    if (limpio.length === 0) throw new Error("El nombre del hotel no puede quedar vacío.");
    if (limpio.length > 60) throw new Error("El nombre del hotel es demasiado largo (máximo 60 caracteres).");
    const file = this.readFile();
    this.writeFile({ ...file, nombre: limpio, lema: lema?.trim() ? lema.trim() : null });
    return this.read();
  }

  setLogo(buffer: Buffer): Brand {
    const stored = this.images.save(buffer);
    const file = this.readFile();
    this.removeLogoFile(file.logoArchivo ?? null);
    this.writeFile({ ...file, logoArchivo: stored.archivo, logoMimeType: stored.mimeType });
    return this.read();
  }

  clearLogo(): Brand {
    const file = this.readFile();
    this.removeLogoFile(file.logoArchivo ?? null);
    this.writeFile({ ...file, logoArchivo: null, logoMimeType: null });
    return this.read();
  }

  private readFile(): BrandFile {
    if (!existsSync(this.filePath)) return {};
    try {
      // El instalador escribe este archivo en UTF-8 con BOM (Inno Setup no
      // ofrece otra cosa en todas sus versiones) y `JSON.parse` no tolera el
      // BOM: se descarta antes de parsear.
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, "utf8").replace(/^﻿/, ""));
      return typeof parsed === "object" && parsed !== null ? (parsed as BrandFile) : {};
    } catch {
      // Un brand.json corrupto no puede impedir que el sistema arranque: se
      // vuelve al nombre por defecto y el admin lo carga de nuevo.
      return {};
    }
  }

  private writeFile(file: BrandFile): void {
    writeFileSync(this.filePath, JSON.stringify({ ...file, actualizadoEn: new Date().toISOString() }, null, 2), "utf8");
  }

  /**
   * El logo puede haber llegado por el asistente de instalación, que copia el
   * archivo que eligió la persona sin poder mirar su contenido. Se revalida
   * acá por bytes reales; si no es una imagen que el navegador vaya a dibujar,
   * se ignora en vez de servir un archivo roto.
   */
  private validLogo(file: BrandFile): string | null {
    const archivo = file.logoArchivo?.trim();
    if (!archivo) return null;
    const path = resolve(this.images.root, archivo);
    if (!path.startsWith(this.images.root) || !existsSync(path)) return null;
    return detectImage(readFileSync(path)) ? archivo : null;
  }

  private removeLogoFile(archivo: string | null): void {
    if (!archivo) return;
    try {
      this.images.delete(archivo);
    } catch {
      // Un logo viejo que no se pudo borrar no debe impedir cargar el nuevo.
    }
  }
}
