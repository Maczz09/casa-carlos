/**
 * All money in Hospedaje Carlos is an integer number of céntimos (1/100 sol).
 * Never a float. `Cents` is a nominal type so a raw `number` cannot slip in
 * without going through `cents()` or `soles()` first.
 */
export type Cents = number & { readonly __brand: "Cents" };

export const ZERO = 0 as Cents;

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new TypeError(`cents() requires an integer, got ${value}`);
  }
  return value as Cents;
}

/** Converts a decimal soles amount (e.g. `45.5` from a form) to Cents, rounding to the nearest céntimo. */
export function soles(amount: number): Cents {
  return cents(Math.round(amount * 100));
}

export function toSoles(value: Cents): number {
  return value / 100;
}

/** Formats as `S/ 45.00`. */
export function format(value: Cents): string {
  const negative = value < 0;
  const abs = Math.abs(value);
  const wholeSoles = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `S/ ${negative ? "-" : ""}${wholeSoles.toLocaleString("es-PE")}.${String(remainder).padStart(2, "0")}`;
  return formatted;
}

export function add(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subtract(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function negate(a: Cents): Cents {
  return cents(-a);
}

/** Multiplies by an integer factor (e.g. quantity). Never use a fractional factor here — see `scale`. */
export function multiply(a: Cents, factor: number): Cents {
  if (!Number.isInteger(factor)) {
    throw new TypeError(`multiply() requires an integer factor, got ${factor}`);
  }
  return cents(a * factor);
}

/** Multiplies by a fractional factor (e.g. a discount rate), rounding to the nearest céntimo. */
export function scale(a: Cents, factor: number): Cents {
  return cents(Math.round(a * factor));
}

export function sum(values: readonly Cents[]): Cents {
  return cents(values.reduce((acc, v) => acc + v, 0));
}

export function isZero(value: Cents): boolean {
  return value === 0;
}

export function isNegative(value: Cents): boolean {
  return value < 0;
}

export function isPositive(value: Cents): boolean {
  return value > 0;
}

export function equal(a: Cents, b: Cents): boolean {
  return a === b;
}

export function max(a: Cents, b: Cents): Cents {
  return a >= b ? a : b;
}

export function min(a: Cents, b: Cents): Cents {
  return a <= b ? a : b;
}

/**
 * Splits `total` into `parts` shares that sum back exactly to `total`.
 * Used e.g. to distribute a rounding remainder; the first shares absorb the
 * extra céntimo(s) so the sum always closes exactly.
 */
export function splitEven(total: Cents, parts: number): Cents[] {
  if (parts <= 0) throw new RangeError("splitEven() requires parts > 0");
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => cents(base + (i < remainder ? 1 : 0)));
}

/** True if a hybrid payment's detail amounts sum exactly to the sale total. */
export function sumEquals(detailAmounts: readonly Cents[], total: Cents): boolean {
  return equal(sum(detailAmounts), total);
}
