import { requireUser } from "@/lib/auth";
import { getBills, type BillFilter } from "@/lib/ledger-service";
import { ledgerDayFromWallClock } from "@/lib/ledger-calc";
import { appNow } from "@/lib/timezone";
import { BillsScreen } from "@/components/ledger/bills-screen";

const FILTERS: BillFilter[] = [
  "todas",
  "pendentes",
  "liquidadas",
  "vencidas",
  "hoje",
  "proximos7",
  "proximos30",
];

/**
 * CONTAS A RECEBER: as entradas ainda não liquidadas.
 *
 * Rota própria, com consulta própria — a mesma razão que separa a visão mensal
 * da geral. O filtro vem da URL e vira cláusula `where` no Prisma; "vencidas"
 * significa vencidas no banco, não vencidas entre as que a página carregou.
 */
export default async function ContasAReceberPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const filtro = FILTERS.includes(params.filtro as BillFilter)
    ? (params.filtro as BillFilter)
    : "pendentes";

  // `appNow` e não `new Date()`: o servidor roda em UTC, e "vencido" precisa
  // ser decidido pelo dia do usuário.
  const now = appNow();
  const view = await getBills(user.id, "ENTRADA", filtro, now);

  return <BillsScreen view={view} todayLedger={ledgerDayFromWallClock(now)} />;
}
