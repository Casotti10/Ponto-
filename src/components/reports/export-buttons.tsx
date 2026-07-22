"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportToCsv, exportToExcel, exportToPdf, type ReportRow } from "@/lib/export-utils";

export function ExportButtons({ rows, filename, title }: { rows: ReportRow[]; filename: string; title: string }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handle(format: "csv" | "excel" | "pdf") {
    if (rows.length === 0) {
      toast.error("Não há dados para exportar neste período");
      return;
    }
    setLoading(format);
    try {
      if (format === "csv") exportToCsv(rows, filename);
      if (format === "excel") await exportToExcel(rows, filename);
      if (format === "pdf") await exportToPdf(rows, filename, title);
      toast.success("Exportação concluída");
    } catch {
      toast.error("Falha ao exportar o relatório");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handle("csv")} disabled={!!loading}>
        <FileDown className="h-3.5 w-3.5" /> CSV
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handle("excel")} disabled={!!loading}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handle("pdf")} disabled={!!loading}>
        <FileText className="h-3.5 w-3.5" /> PDF
      </Button>
    </div>
  );
}
