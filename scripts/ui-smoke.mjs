import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { floors, product, session, responseFor } from './ui-smoke-fixtures.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.cache/ui-smoke');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const kiosk = url.pathname.startsWith('/kiosk/');
  const dist = path.join(root, 'apps', kiosk ? 'web-kiosk' : 'web-reception', 'dist');
  const relative = decodeURIComponent(kiosk ? url.pathname.slice(7) : url.pathname.slice(1));
  let file = path.resolve(dist, relative || 'index.html');
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(dist, 'index.html');
  res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.UI_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = { modules: [], subviews: [], kiosk: [], accessibility: [], errors: [], requests: [] };

async function setup(context, authenticated = true) {
  await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const body = request.postDataJSON() ?? {};
    results.requests.push({ path: url.pathname, method: request.method(), body });
    await route.fulfill({ json: responseFor(url, request.method(), body) });
  });
  await context.addInitScript(({ floors, product, authenticated }) => {
    if (authenticated) localStorage.setItem('cc_token', 'ui-test');
    localStorage.setItem('casacarlos.tour.v2', 'done');
    localStorage.setItem('casacarlos.theme_override', 'light');
    localStorage.setItem('casacarlos-kiosk.theme_override', 'light');
    window.__uiSockets = [];
    window.__uiDispatch = message => window.__uiSockets.forEach(socket => socket.onmessage?.({ data: JSON.stringify(message) }));
    window.WebSocket = class {
      readyState = 1; static OPEN = 1;
      constructor() { window.__uiSockets.push(this); setTimeout(() => { this.onopen?.({}); this.onmessage?.({ data: JSON.stringify({ type: 'board', floors }) }); this.onmessage?.({ data: JSON.stringify({ type: 'products', products: [product] }) }); }, 60); }
      close() { window.__uiSockets = window.__uiSockets.filter(socket => socket !== this); }
      send() {} addEventListener() {} removeEventListener() {}
    };
  }, { floors, product, authenticated });
}
async function audit(page, label) {
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  const violations = scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, summary: n.failureSummary })) }));
  results.accessibility.push({ label, violations });
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
  await setup(context);
  const page = await context.newPage();
  page.on('pageerror', error => results.errors.push(error.message));
  const modules = ['tablero','venta','reservas','caja','anulaciones','bodega','categorias','cuartos-admin','comprobantes','dashboard','reportes','notificaciones','usuarios','ajustes','cuarto/room-102'];
  for (const theme of ['light','dark']) {
    for (const module of modules) {
      await page.goto(`${base}/#/${module}`);
      await page.locator('main h1').first().waitFor();
      await page.evaluate(value => { document.documentElement.dataset.theme = value; localStorage.setItem('casacarlos.theme_override', value); }, theme);
      await page.waitForTimeout(module === 'reportes' ? 900 : 220);
      assert.equal(await page.getByText('No pudimos abrir este módulo', { exact: true }).count(), 0, module);
      const title = await page.locator('main h1').first().innerText();
      results.modules.push({ module, theme, title });
      await page.screenshot({ path: path.join(out, `${module.replaceAll('/','-')}-${theme}.png`), fullPage: true });
      await audit(page, `${module}-${theme}`);
      console.log(`OK ${module} ${theme}`);
    }
  }
  const subviews = {
    caja: ['Turnos y Horarios','Movimientos','Ventas','Anulaciones','Cierres'],
    'cuartos-admin': ['Categorías','Tarifas y Precios (Horas / Noche / Día)'],
    notificaciones: ['Destinatarios','Plantillas','Cola'],
    ajustes: ['Tema y Apariencia','Turnos de Caja','Cobros','Facturación SUNAT'],
  };
  for (const [module, views] of Object.entries(subviews)) {
    await page.goto(`${base}/#/${module}`);
    for (const view of views) {
      await page.getByRole('group', { name: 'Vistas del módulo' }).getByRole('button', { name: view, exact: true }).click();
      await page.waitForTimeout(250);
      assert.equal(await page.getByText('No pudimos abrir este módulo', { exact: true }).count(), 0, `${module}/${view}`);
      results.subviews.push({ module, view });
      await audit(page, `${module}/${view}`);
    }
  }
  // Revisión retroactiva: el motivo y la devolución deben confirmarse antes de cerrar.
  await page.goto(`${base}/#/cuarto/room-102`);
  await page.getByRole('button', { name: 'Check-out', exact: true }).click();
  await page.getByRole('button', { name: 'Hace 1 hora', exact: true }).click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'El selector de salida debe caber en la pantalla');
  await page.getByRole('button', { name: 'Revisar cuenta y salida', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Revisar salida y cuenta' });
  await checkout.getByText('Saldo por cobrar', { exact: true }).waitFor();
  const finalize = checkout.getByRole('button', { name: 'Confirmar y cerrar estadía', exact: true });
  assert.equal(await finalize.isEnabled(), false);
  await checkout.getByRole('textbox').fill('El huésped salió antes del horario previsto');
  assert.equal(await finalize.isEnabled(), false);
  await checkout.getByRole('checkbox', { name: 'Confirmo que devolví estos importes al huésped.' }).check();
  assert.equal(await finalize.isEnabled(), true);
  await audit(page, 'checkout-retroactivo');
  await page.screenshot({ path: path.join(out, 'checkout-revision.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await checkout.waitFor({ state: 'hidden' });
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Revisar cuenta y salida/);
  // El filtro modifica la vista sin esconder cuartos ni modificar los datos.
  await page.goto(`${base}/#/tablero`);
  await page.getByRole('textbox', { name: 'Buscar cuartos del piso' }).fill('101');
  await page.getByRole('status').filter({ hasText: '1 de 3 cuartos' }).waitFor();
  await page.getByRole('textbox', { name: 'Buscar cuartos del piso' }).fill('999');
  await page.getByText('Sin cuartos para estos filtros').waitFor();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  // Confirmación de usuario: foco, Escape y devolución al control original.
  await page.goto(`${base}/#/usuarios`);
  await page.getByRole('button').filter({ hasText: 'Luis Turno' }).click();
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await confirmation.waitFor();
  await audit(page, 'confirmacion-usuario');
  await page.keyboard.press('Tab');
  assert.ok(await confirmation.evaluate(el => el.contains(document.activeElement)));
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  // Sheet en pantalla estrecha: foco aislado, Escape y navegación habilitada por permisos.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await page.getByRole('dialog', { name: 'Navegación de recepción' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Navegación de recepción' }).waitFor({ state: 'hidden' });
  await page.screenshot({ path: path.join(out, 'usuarios-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  // Acceso sin token, pestañas con flechas y nombres de formulario.
  const loginContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await setup(loginContext, false);
  const login = await loginContext.newPage();
  await login.goto(base);
  await login.getByRole('tab', { name: 'Usuario', exact: true }).focus();
  await login.keyboard.press('ArrowRight');
  await login.getByRole('tab', { name: 'PIN rápido' }).waitFor();
  await audit(login, 'login');
  await login.screenshot({ path: path.join(out, 'login.png'), fullPage: true });
  // Las siete pantallas se activan mediante los mismos mensajes que recepción.
  const kiosk = await context.newPage();
  kiosk.on('pageerror', error => results.errors.push(error.message));
  await kiosk.goto(`${base}/kiosk/`);
  await kiosk.getByRole('heading', { name: 'Hospedaje Carlos', exact: true }).waitFor();
  for (const state of ['ESPERA','SELECCION_PISO','SELECCION_CUARTO','DATOS_CLIENTE','SELECCION_PRODUCTOS','SELECCION_PAGO','ACEPTADO','RECHAZADO']) {
    await kiosk.evaluate(message => window.__uiDispatch(message), { type: 'kiosk', session: { ...session, estado: state } });
    await kiosk.waitForTimeout(250);
    const heading = await kiosk.locator('h1').first().innerText();
    assert.ok(heading);
    results.kiosk.push({ state, heading });
    await kiosk.screenshot({ path: path.join(out, `kiosk-${state}.png`), fullPage: true });
    if (state !== 'ACEPTADO') await audit(kiosk, `kiosk-${state}`);
    console.log(`OK kiosk ${state}`);
  }
  assert.deepEqual(results.errors, [], 'Errores de ejecución del navegador');
  assert.deepEqual(results.accessibility.filter(scan => scan.violations.length), [], 'Incidencias de accesibilidad en las vistas comprobadas');
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`Validación UI completada. Evidencia: ${out}`);
