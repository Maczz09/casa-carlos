/** Sustituye `{{variable}}` en la plantilla; deja el token intacto si la variable no llegó. */
export function renderTemplate(cuerpo: string, vars: Record<string, string>): string {
  return cuerpo.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}
