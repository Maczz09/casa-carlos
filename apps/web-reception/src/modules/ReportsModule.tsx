import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { DashboardReport } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { IconFileChart } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { useBrand } from "../hooks/useBrand.js";
import { exportErrorMessage, saveExport } from "../lib/saveExport.js";
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Skeleton } from "../components/ui.js";
import { METHOD_LABEL } from "./CashboxModule.js";

const todayIso = () => new Date().toISOString().slice(0, 10);
const startOfMonthIso = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};

const toSheet = (
  id: string,
  name: string,
  order: number,
  rows: Array<Array<string | number>>,
  active = false,
  headerRow = 3,
) => ({
  id,
  name,
  order,
  status: active ? 1 : 0,
  row: Math.max(36, rows.length + 6),
  column: 10,
  defaultRowHeight: 24,
  defaultColWidth: 112,
  config: {
    columnlen: { 0: 190, 1: 150, 2: 130, 3: 130 },
    rowlen: { 0: 34, 3: 28 },
  },
  celldata: rows.flatMap((row, rowIndex) =>
    row.map((value, columnIndex) => ({
      r: rowIndex,
      c: columnIndex,
      v: {
        v: value,
        m: String(value ?? ""),
        ct: typeof value === "number" ? { fa: "0.00", t: "n" } : { fa: "General", t: "g" },
        fs: rowIndex === 0 || rowIndex === headerRow ? 12 : 11,
        bl: rowIndex === 0 || rowIndex === headerRow ? 1 : 0,
        fc: rowIndex === 0 && headerRow !== 0 ? "#0f766e" : rowIndex === headerRow ? "#0f1b33" : "#34445f",
        bg: rowIndex === headerRow ? "#dff7f3" : undefined,
        vt: 0,
      },
    })),
  ),
});

interface LoadedLogo {
  dataUrl: string;
  width: number;
  height: number;
}

async function loadLogoAsPng(url: string | null): Promise<LoadedLogo | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("No se pudo leer el logo."));
        element.src = objectUrl;
      });
      const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

const currency = (centimos: number) => centimos / 100;
const paymentTotal = (report: DashboardReport) => report.ingresosPorMetodo.reduce((sum, item) => sum + item.totalCentimos, 0);
const igvTotal = (report: DashboardReport) => report.serieTemporal.reduce((sum, point) => sum + point.igvCentimos, 0);

export function ReportsModule() {
  const brand = useBrand();
  const [desde, setDesde] = useState(startOfMonthIso());
  const [hasta, setHasta] = useState(todayIso());
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [workbookRevision, setWorkbookRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextReport = await api.dashboard({ desde, hasta });
      setReport(nextReport);
      setWorkbookRevision((revision) => revision + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo preparar el reporte.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workbookData = useMemo<ComponentProps<typeof Workbook>["data"]>(() => {
    if (!report) return [toSheet("summary", "Resumen", 0, [["Reporte sin datos"]], true)];
    const cobrosCentimos = paymentTotal(report);
    const totalIgvCentimos = igvTotal(report);
    const summaryRows: Array<Array<string | number>> = [
      [brand.nombre, "Reporte de gestión"],
      ["Periodo", `${desde} a ${hasta}`],
      [],
      ["Indicador", "Valor"],
      ["Ventas registradas (S/)", currency(report.comparativa.actual.ventasCentimos)],
      ["Cobros aceptados (S/)", currency(cobrosCentimos)],
      ["IGV incluido (S/)", currency(totalIgvCentimos)],
      ["Diferencia ventas - cobros (S/)", currency(report.comparativa.actual.ventasCentimos - cobrosCentimos)],
      ["Cantidad de ventas", report.comparativa.actual.cantidadVentas],
      ["Cuartos alquilados", report.comparativa.actual.cuartosAlquilados],
      ["Ticket promedio (S/)", currency(report.comparativa.actual.ticketPromedioCentimos)],
      ["Ocupación", `${report.comparativa.actual.ocupacionPct.toFixed(2)}%`],
    ];
    const dailyRows: Array<Array<string | number>> = [
      ["Fecha", "Ventas S/", "IGV S/", "Operaciones"],
      ...report.serieTemporal.map((point) => [point.fecha, currency(point.ventasCentimos), currency(point.igvCentimos), point.cantidadVentas]),
    ];
    const methodsRows: Array<Array<string | number>> = [
      ["Método", "Operaciones", "Total S/"],
      ...report.ingresosPorMetodo.map((item) => [METHOD_LABEL[item.metodo] ?? item.metodo, item.cantidad, currency(item.totalCentimos)]),
    ];
    return [
      toSheet("summary", "Resumen", 0, summaryRows, true),
      toSheet("daily-sales", "Ventas diarias", 1, dailyRows, false, 0),
      toSheet("payment-methods", "Métodos de pago", 2, methodsRows, false, 0),
    ] as ComponentProps<typeof Workbook>["data"];
  }, [brand.nombre, desde, hasta, report]);

  const exportExcel = async () => {
    if (!report) return;
    setExporting("xlsx");
    setExportNotice(null);
    try {
      const totals = report.comparativa.actual;
      const cobrosCentimos = paymentTotal(report);
      const totalIgvCentimos = igvTotal(report);
      const workbook = XLSX.utils.book_new();
      workbook.Props = { Title: `Reporte de gestión ${desde} a ${hasta}`, Subject: brand.nombre, Company: brand.nombre };

      const resumen = XLSX.utils.aoa_to_sheet([
        [brand.nombre, "Reporte de gestión"],
        ["Periodo", `${desde} a ${hasta}`],
        [],
        ["Indicador", "Valor"],
        ["Ventas registradas", currency(totals.ventasCentimos)],
        ["Cobros aceptados", currency(cobrosCentimos)],
        ["IGV incluido", currency(totalIgvCentimos)],
        ["Diferencia ventas - cobros", currency(totals.ventasCentimos - cobrosCentimos)],
        ["Cantidad de ventas", totals.cantidadVentas],
        ["Cuartos alquilados", totals.cuartosAlquilados],
        ["Ticket promedio", currency(totals.ticketPromedioCentimos)],
        ["Ocupación", totals.ocupacionPct / 100],
      ]);
      resumen["!cols"] = [{ wch: 34 }, { wch: 24 }];
      ["B5", "B6", "B7", "B8", "B11"].forEach((cell) => {
        if (resumen[cell]) resumen[cell].z = '"S/" #,##0.00';
      });
      if (resumen.B12) resumen.B12.z = "0.00%";

      const ventasRows: Array<Array<string | number>> = [
        ["Fecha", "Operaciones", "Ventas (S/)", "IGV incluido (S/)"],
        ...report.serieTemporal.map((point) => [point.fecha, point.cantidadVentas, currency(point.ventasCentimos), currency(point.igvCentimos)]),
        ["TOTAL", totals.cantidadVentas, currency(totals.ventasCentimos), currency(totalIgvCentimos)],
      ];
      const ventas = XLSX.utils.aoa_to_sheet(ventasRows);
      ventas["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
      ventas["!autofilter"] = { ref: `A1:D${Math.max(2, ventasRows.length - 1)}` };
      for (let row = 2; row <= ventasRows.length; row += 1) {
        if (ventas[`C${row}`]) ventas[`C${row}`].z = '"S/" #,##0.00';
        if (ventas[`D${row}`]) ventas[`D${row}`].z = '"S/" #,##0.00';
      }

      const metodosRows: Array<Array<string | number>> = [
        ["Método de pago", "Operaciones", "Total (S/)"],
        ...report.ingresosPorMetodo.map((item) => [METHOD_LABEL[item.metodo] ?? item.metodo, item.cantidad, currency(item.totalCentimos)]),
        ["TOTAL", report.ingresosPorMetodo.reduce((sum, item) => sum + item.cantidad, 0), currency(cobrosCentimos)],
      ];
      const metodos = XLSX.utils.aoa_to_sheet(metodosRows);
      metodos["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 18 }];
      metodos["!autofilter"] = { ref: `A1:C${Math.max(2, metodosRows.length - 1)}` };
      for (let row = 2; row <= metodosRows.length; row += 1) {
        if (metodos[`C${row}`]) metodos[`C${row}`].z = '"S/" #,##0.00';
      }

      XLSX.utils.book_append_sheet(workbook, resumen, "Resumen");
      XLSX.utils.book_append_sheet(workbook, ventas, "Ventas diarias");
      XLSX.utils.book_append_sheet(workbook, metodos, "Métodos de pago");

      const contents = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
      const blob = new Blob([contents], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const saved = await saveExport(blob, `reporte-completo-${desde}-a-${hasta}.xlsx`);
      setExportNotice(saved.desktop ? `Excel completo guardado en ${saved.location ?? "Descargas"}.` : "Excel completo descargado correctamente.");
    } catch (err) {
      setExportNotice(`No se pudo crear el Excel: ${exportErrorMessage(err)}`);
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!report) return;
    setExporting("pdf");
    setExportNotice(null);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const logo = await loadLogoAsPng(brand.logoUrl);
      const totals = report.comparativa.actual;
      const totalIgvCentimos = igvTotal(report);
      const cobrosCentimos = paymentTotal(report);
      const pageWidth = doc.internal.pageSize.getWidth();
      const drawHeader = (section: string) => {
        let textX = 16;
        if (logo) {
          const maxWidth = 22;
          const maxHeight = 15;
          const ratio = Math.min(maxWidth / logo.width, maxHeight / logo.height);
          const width = logo.width * ratio;
          const height = logo.height * ratio;
          doc.addImage(logo.dataUrl, "PNG", 16, 11, width, height);
          textX = 16 + width + 5;
        }
        doc.setTextColor(15, 27, 51);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(brand.nombre, textX, 17);
        doc.setFontSize(11);
        doc.text(section, textX, 24);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(85, 99, 125);
        doc.setFontSize(8.5);
        doc.text(`Periodo: ${desde} a ${hasta}`, textX, 30);
        doc.setDrawColor(210, 221, 235);
        doc.line(16, 35, pageWidth - 16, 35);
        return 43;
      };
      const drawTableHeading = (labels: Array<{ text: string; x: number; align?: "left" | "right" }>, y: number) => {
        doc.setFillColor(224, 247, 243);
        doc.roundedRect(16, y - 4.5, pageWidth - 32, 8, 1.5, 1.5, "F");
        doc.setTextColor(15, 118, 110);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        labels.forEach((label) => doc.text(label.text, label.x, y, { align: label.align ?? "left" }));
        doc.setFont("helvetica", "normal");
        return y + 7;
      };

      let y = drawHeader("Reporte de gestión · Resumen");
      const indicators = [
        ["Ventas registradas", format(cents(totals.ventasCentimos))],
        ["Cobros aceptados", format(cents(cobrosCentimos))],
        ["IGV incluido", format(cents(totalIgvCentimos))],
        ["Diferencia ventas - cobros", format(cents(totals.ventasCentimos - cobrosCentimos))],
        ["Cantidad de ventas", String(totals.cantidadVentas)],
        ["Cuartos alquilados", String(totals.cuartosAlquilados)],
        ["Ticket promedio", format(cents(totals.ticketPromedioCentimos))],
        ["Ocupación del periodo", `${totals.ocupacionPct.toFixed(2)}%`],
      ];
      y = drawTableHeading([{ text: "Indicador", x: 20 }, { text: "Valor", x: pageWidth - 20, align: "right" }], y);
      doc.setFontSize(9.5);
      indicators.forEach(([label, value]) => {
        doc.setTextColor(85, 99, 125);
        doc.text(label!, 20, y);
        doc.setTextColor(15, 27, 51);
        doc.setFont("helvetica", "bold");
        doc.text(value!, pageWidth - 20, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 8.5;
      });

      doc.addPage();
      y = drawHeader("Reporte de gestión · Ventas diarias");
      const dailyHeader = () => drawTableHeading([
        { text: "Fecha", x: 20 },
        { text: "Operaciones", x: 94, align: "right" },
        { text: "Ventas", x: 142, align: "right" },
        { text: "IGV", x: pageWidth - 20, align: "right" },
      ], y);
      y = dailyHeader();
      for (const point of report.serieTemporal) {
        if (y > 278) {
          doc.addPage();
          y = drawHeader("Reporte de gestión · Ventas diarias");
          y = dailyHeader();
        }
        doc.setTextColor(85, 99, 125);
        doc.setFontSize(8.5);
        doc.text(point.fecha, 20, y);
        doc.setTextColor(15, 27, 51);
        doc.text(String(point.cantidadVentas), 94, y, { align: "right" });
        doc.text(format(cents(point.ventasCentimos)), 142, y, { align: "right" });
        doc.text(format(cents(point.igvCentimos)), pageWidth - 20, y, { align: "right" });
        y += 6;
      }
      if (y > 270) {
        doc.addPage();
        y = drawHeader("Reporte de gestión · Ventas diarias");
        y = dailyHeader();
      }
      doc.setDrawColor(210, 221, 235);
      doc.line(16, y - 2, pageWidth - 16, y - 2);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL", 20, y + 4);
      doc.text(String(totals.cantidadVentas), 94, y + 4, { align: "right" });
      doc.text(format(cents(totals.ventasCentimos)), 142, y + 4, { align: "right" });
      doc.text(format(cents(totalIgvCentimos)), pageWidth - 20, y + 4, { align: "right" });

      doc.addPage();
      y = drawHeader("Reporte de gestión · Métodos de pago");
      y = drawTableHeading([
        { text: "Método", x: 20 },
        { text: "Operaciones", x: 128, align: "right" },
        { text: "Total", x: pageWidth - 20, align: "right" },
      ], y);
      doc.setFontSize(9);
      for (const item of report.ingresosPorMetodo) {
        doc.setTextColor(85, 99, 125);
        doc.text(METHOD_LABEL[item.metodo] ?? item.metodo, 20, y);
        doc.setTextColor(15, 27, 51);
        doc.text(String(item.cantidad), 128, y, { align: "right" });
        doc.text(format(cents(item.totalCentimos)), pageWidth - 20, y, { align: "right" });
        y += 7;
      }
      doc.setDrawColor(210, 221, 235);
      doc.line(16, y - 2, pageWidth - 16, y - 2);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL COBRADO", 20, y + 4);
      doc.text(String(report.ingresosPorMetodo.reduce((sum, item) => sum + item.cantidad, 0)), 128, y + 4, { align: "right" });
      doc.text(format(cents(cobrosCentimos)), pageWidth - 20, y + 4, { align: "right" });

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(113, 128, 150);
        doc.text(`${brand.nombre} · Página ${page} de ${totalPages}`, pageWidth / 2, 290, { align: "center" });
      }
      const blob = doc.output("blob");
      const saved = await saveExport(blob, `reporte-${desde}-a-${hasta}.pdf`);
      setExportNotice(saved.desktop ? `PDF guardado en ${saved.location ?? "Descargas"}.` : "PDF descargado correctamente.");
    } catch (err) {
      setExportNotice(`No se pudo crear el PDF: ${exportErrorMessage(err)}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Hoja interactiva para analizar, copiar y exportar los datos del hotel"
        actions={<div className="flex gap-2"><Button onClick={() => void exportExcel()} disabled={!report || exporting !== null}>{exporting === "xlsx" ? "Creando…" : "Descargar Excel"}</Button><Button variant="primary" onClick={() => void exportPdf()} disabled={!report || exporting !== null}>{exporting === "pdf" ? "Creando…" : "Crear PDF"}</Button></div>}
      />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Desde"><Input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} /></Field>
        <Field label="Hasta"><Input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} /></Field>
        <Button variant="primary" onClick={load} disabled={loading}>{loading ? "Preparando…" : "Actualizar reporte"}</Button>
        <p className="ml-auto max-w-md text-xs leading-relaxed text-muted">Podés editar celdas, copiar rangos y probar fórmulas sin alterar la base de datos. La hoja es una vista de análisis.</p>
      </Card>

      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      {exportNotice && <div className="mb-4"><Notice>{exportNotice}</Notice></div>}
      {loading && !report ? (
        <Skeleton className="h-[620px] rounded-2xl" />
      ) : !report ? (
        <Card className="p-8"><EmptyState icon={<IconFileChart className="h-6 w-6" />} title="No hay reporte disponible" hint="Elegí otro periodo y volvé a intentar." /></Card>
      ) : (
        <Card className="overflow-hidden p-1">
          <div className="h-[650px] min-h-[520px] overflow-hidden rounded-[14px]">
            <Workbook
              key={`${desde}:${hasta}:${workbookRevision}`}
              data={workbookData}
              row={36}
              column={10}
              currency="S/"
              showToolbar
              showFormulaBar
              showSheetTabs
              lang="es"
            />
          </div>
        </Card>
      )}
    </>
  );
}
