import { minutesToHM } from "@/lib/time-calc";

export interface ReportRow {
  date: string;
  status: string;
  worked: string;
  expected: string;
  extra: string;
  negative: string;
  balance: string;
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETO: "Completo",
  HORA_EXTRA: "Hora extra",
  INCOMPLETO: "Incompleto",
  FALTA_NAO_REGISTRADA: "Falta não registrada",
  FALTA_JUSTIFICADA: "Falta justificada",
  FALTA_INJUSTIFICADA: "Falta injustificada",
  FERIAS: "Férias",
  LICENCA: "Licença",
  FOLGA: "Folga",
  BANCO_HORAS: "Banco de horas",
  COMPENSACAO: "Compensação",
  HOME_OFFICE: "Home office",
  TRABALHO_FOLGA: "Trabalho em folga",
  FOLGA_PADRAO: "Fim de semana",
  FUTURO: "Futuro",
  EM_ANDAMENTO: "Em andamento",
};

export function buildReportRows(
  days: {
    date: Date;
    status: string;
    workedMinutes: number;
    expectedMinutes: number;
    extraMinutes: number;
    negativeMinutes: number;
    balanceDeltaMinutes: number;
  }[]
): ReportRow[] {
  return days.map((d) => ({
    date: d.date.toLocaleDateString("pt-BR"),
    status: STATUS_LABELS[d.status] ?? d.status,
    worked: minutesToHM(d.workedMinutes),
    expected: minutesToHM(d.expectedMinutes),
    extra: minutesToHM(d.extraMinutes),
    negative: minutesToHM(d.negativeMinutes),
    balance: minutesToHM(d.balanceDeltaMinutes),
  }));
}

/**
 * Tabela genérica de exportação.
 *
 * Toda exportação do sistema (ponto e financeiro) é reduzida a cabeçalhos +
 * linhas de texto já formatadas; assim existe UMA implementação de CSV, Excel e
 * PDF, e um novo relatório só precisa fornecer os dados.
 */
export interface ExportTable {
  headers: string[];
  rows: string[][];
  /** Nome da aba no Excel. */
  sheetName?: string;
}

export function exportTableToCsv(table: ExportTable, filename: string) {
  const lines = [table.headers.join(";"), ...table.rows.map((row) => row.join(";"))];
  // BOM inicial: sem ele o Excel em pt-BR abre os acentos quebrados.
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportTableToExcel(table: ExportTable, filename: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, table.sheetName ?? "Relatório");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportTableToPdf(table: ExportTable, filename: string, title: string) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [table.headers],
    body: table.rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [42, 120, 214] },
  });

  doc.save(`${filename}.pdf`);
}

const REPORT_HEADERS = ["Data", "Status", "Trabalhado", "Previsto", "Extra", "Negativo", "Saldo"];

function reportTable(rows: ReportRow[]): ExportTable {
  return {
    headers: REPORT_HEADERS,
    rows: rows.map((r) => [r.date, r.status, r.worked, r.expected, r.extra, r.negative, r.balance]),
  };
}

export function exportToCsv(rows: ReportRow[], filename: string) {
  exportTableToCsv(reportTable(rows), filename);
}

export async function exportToExcel(rows: ReportRow[], filename: string) {
  await exportTableToExcel(reportTable(rows), filename);
}

export async function exportToPdf(rows: ReportRow[], filename: string, title: string) {
  await exportTableToPdf(reportTable(rows), filename, title);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
