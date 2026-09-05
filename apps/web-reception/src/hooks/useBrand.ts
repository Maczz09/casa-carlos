import { useEffect, useState } from "react";
import type { Brand } from "@casacarlos/contracts";
import { api } from "../api.js";

const FALLBACK: Brand = { nombre: "Hospedaje Carlos", lema: "Sistema de hospedaje", logoUrl: null };

let actual: Brand = FALLBACK;
let cargado = false;
const suscriptores = new Set<(brand: Brand) => void>();

/**
 * La marca la necesitan la pantalla de acceso (sin sesión todavía), la barra
 * lateral y los tickets impresos, que se arman fuera de React. Por eso vive en
 * un store diminuto de módulo y no en un contexto: `getBrand()` la lee de forma
 * síncrona desde cualquier lado y `useBrand()` re-renderiza a quien la muestre
 * cuando el administrador la cambia en Ajustes.
 */
export function getBrand(): Brand {
  return actual;
}

export function setBrand(brand: Brand): void {
  actual = brand;
  cargado = true;
  for (const notificar of suscriptores) notificar(brand);
}

export function loadBrand(): void {
  api
    .brand()
    .then(setBrand)
    .catch(() => {
      // Sin conexión con el servidor se sigue mostrando el nombre por defecto:
      // que no se pueda leer la marca no puede dejar la pantalla en blanco.
      cargado = true;
    });
}

export function useBrand(): Brand {
  const [brand, setLocal] = useState<Brand>(actual);
  useEffect(() => {
    suscriptores.add(setLocal);
    if (!cargado) loadBrand();
    return () => {
      suscriptores.delete(setLocal);
    };
  }, []);
  return brand;
}
