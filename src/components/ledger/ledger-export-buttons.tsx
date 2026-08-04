"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  exportTableToCsv,
  exportTableToExcel,
  exportTableToPdf,
  type ExportTable,
} from "@/lib/export-utils";

/**
 * Exportação dos lançamentos do mês.
 *
 * A tabela chega pronta do servidor (valores já formatados), então o cliente só
 * escolhe o formato — e as bibliotecas pesadas (xlsx/jspdf) continuam sendo
 * carregadas sob demanda dentro de `export-utils`.
 */
export function FinancialExportButtons({
  table,
  filename,
  title,
}: {
  table: ExportTable;
  filename: string;
  title: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handle(format: "csv" | "excel" | "pdf") {
    if (table.rows.length === 0) {
      toast.error("Não há lançamentos para exportar neste período");
      return;
    }
    setLoading(format);
    try {
      if (format === "csv") exportTableToCsv(table, filename);
      if (format === "excel") await exportTableToExcel(table, filename);
      if (format === "pdf") await exportTableToPdf(table, filename, title);
      toast.success("Exportação concluída");
    } catch {
      toast.error("Falha ao exportar");
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
