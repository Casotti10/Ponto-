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

export function exportToCsv(rows: ReportRow[], filename: string) {
  const headers = ["Data", "Status", "Trabalhado", "Previsto", "Extra", "Negativo", "Saldo"];
  const lines = [
    headers.join(";"),
    ...rows.map((r) => [r.date, r.status, r.worked, r.expected, r.extra, r.negative, r.balance].join(";")),
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportToExcel(rows: ReportRow[], filename: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      Data: r.date,
      Status: r.status,
      Trabalhado: r.worked,
      Previsto: r.expected,
      Extra: r.extra,
      Negativo: r.negative,
      Saldo: r.balance,
    }))
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportToPdf(rows: ReportRow[], filename: string, title: string) {
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
    head: [["Data", "Status", "Trabalhado", "Previsto", "Extra", "Negativo", "Saldo"]],
    body: rows.map((r) => [r.date, r.status, r.worked, r.expected, r.extra, r.negative, r.balance]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [42, 120, 214] },
  });

  doc.save(`${filename}.pdf`);
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
