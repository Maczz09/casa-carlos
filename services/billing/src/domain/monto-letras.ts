const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];

const DIEZ_A_VEINTINUEVE = [
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
  "VEINTIUNO",
  "VEINTIDÓS",
  "VEINTITRÉS",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISÉIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];

const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];

const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function convertirDecenas(n: number): string {
  if (n === 0) return "";
  if (n < 10) return UNIDADES[n]!;
  if (n < 30) return DIEZ_A_VEINTINUEVE[n - 10]!;
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d]! : `${DECENAS[d]} Y ${UNIDADES[u]}`;
}

function convertirGrupo(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]!);
  const decenas = convertirDecenas(resto);
  if (decenas) partes.push(decenas);
  return partes.join(" ");
}

/** Convierte un entero no negativo a su representación en letras, en español, mayúsculas. */
export function numeroALetras(n: number): string {
  if (n === 0) return "CERO";

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? "UN MILLÓN" : `${convertirGrupo(millones)} MILLONES`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? "MIL" : `${convertirGrupo(miles)} MIL`);
  }
  if (resto > 0) {
    partes.push(convertirGrupo(resto));
  }
  return partes.join(" ");
}

/** "SON CIENTO DIECIOCHO CON 00/100 SOLES" — el formato exacto que SUNAT espera en cbc:Note del UBL. */
export function montoEnLetras(totalCentimos: number, moneda = "SOLES"): string {
  const soles = Math.floor(totalCentimos / 100);
  const centimos = totalCentimos % 100;
  return `SON ${numeroALetras(soles)} CON ${String(centimos).padStart(2, "0")}/100 ${moneda}`;
}
