/**
 * Regras de integridade financeira do razao.
 *
 * Rode com: npm run test:ledger
 *
 * Cada caso aqui protege um numero que, se errado, sai PLAUSIVEL e FALSO: um
 * cancelado que continua somando ou uma transferencia contada como receita nao
 * quebram a tela, so mentem. E o tipo de bug que nao aparece sem teste.
 */
import {
  summarizeTransactions,
  ledgerDayFromWallClock,
  computeAccountBalances,
  breakdownByCategory,
  buildDailyFlow,
  isOverdue,
  ledgerDayFromISO,
  type TransactionLike,
} from "../src/lib/ledger-calc";

let fails = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ok   ${label}`);
  else {
    fails++;
    console.log(`  FALHA ${label}\n         esperado: ${e}\n         obtido:   ${a}`);
  }
}

const HOJE = ledgerDayFromISO("2026-08-20");

let seq = 0;
function tx(p: Partial<TransactionLike> & { amountCents: number; type: "ENTRADA" | "SAIDA" }): TransactionLike {
  return {
    id: `t${++seq}`,
    date: ledgerDayFromISO("2026-08-10"),
    description: "x",
    accountId: "acc1",
    categoryId: null,
    ...p,
  };
}

console.log("\n== realizado x previsto ==");
const lote: TransactionLike[] = [
  tx({ amountCents: 500000, type: "ENTRADA", status: "LIQUIDADO" }), // salário recebido
  tx({ amountCents: 350000, type: "SAIDA", status: "LIQUIDADO" }), // aluguel pago
  tx({ amountCents: 300000, type: "ENTRADA", status: "PENDENTE", dueDate: ledgerDayFromISO("2026-08-30") }), // a receber
  tx({ amountCents: 150000, type: "SAIDA", status: "PENDENTE", dueDate: ledgerDayFromISO("2026-08-28") }), // a pagar
];
const t = summarizeTransactions(lote, HOJE);
check("receita realizada", t.incomeCents, 500000);
check("despesa realizada", t.expenseCents, 350000);
check("saldo real", t.balanceCents, 150000);
check("a receber", t.pendingIncomeCents, 300000);
check("a pagar", t.pendingExpenseCents, 150000);
// 1.500 + 3.000 - 1.500 = 3.000
check("saldo projetado", t.projectedBalanceCents, 300000);
check("economia sobre o realizado", t.savingsRate, 30);

console.log("\n== pendente NAO mexe no saldo real ==");
const contas = [
  { id: "acc1", name: "Corrente", type: "CORRENTE", openingBalanceCents: 100000, color: "#000", archived: false },
];
const saldos = computeAccountBalances(contas, lote);
// 1.000 de abertura + 5.000 recebido - 3.500 pago = 2.500. Os pendentes não entram.
check("saldo da conta ignora pendentes", saldos[0].balanceCents, 250000);

console.log("\n== cancelado nao impacta nada ==");
const comCancelado = [
  ...lote,
  tx({ amountCents: 999999, type: "SAIDA", status: "CANCELADO" }),
];
const tc = summarizeTransactions(comCancelado, HOJE);
check("despesa nao muda", tc.expenseCents, 350000);
check("saldo projetado nao muda", tc.projectedBalanceCents, 300000);
check("cancelado e contado a parte", tc.cancelledCount, 1);
check("saldo da conta ignora cancelado", computeAccountBalances(contas, comCancelado)[0].balanceCents, 250000);

console.log("\n== transferencia nao e receita nem despesa ==");
const comTransferencia: TransactionLike[] = [
  ...lote,
  tx({ amountCents: 200000, type: "SAIDA", status: "LIQUIDADO", transferGroupId: "g1" }),
  tx({ amountCents: 200000, type: "ENTRADA", status: "LIQUIDADO", transferGroupId: "g1", accountId: "acc2" }),
];
const tt = summarizeTransactions(comTransferencia, HOJE);
check("receita nao infla", tt.incomeCents, 500000);
check("despesa nao infla", tt.expenseCents, 350000);
check("resultado intacto", tt.balanceCents, 150000);
check("transferencias contadas a parte", tt.transferCount, 2);

console.log("\n== mas transferencia MOVE dinheiro entre as contas ==");
const duasContas = [
  ...contas,
  { id: "acc2", name: "Poupanca", type: "POUPANCA", openingBalanceCents: 0, color: "#000", archived: false },
];
const s2 = computeAccountBalances(duasContas, comTransferencia);
check("origem perdeu 2.000", s2[0].balanceCents, 50000); // 2.500 - 2.000
check("destino ganhou 2.000", s2[1].balanceCents, 200000);
check("soma das contas preservada", s2[0].balanceCents + s2[1].balanceCents, 250000);

console.log("\n== vencido e derivado da data de hoje ==");
const vencida = tx({
  amountCents: 50000,
  type: "SAIDA",
  status: "PENDENTE",
  dueDate: ledgerDayFromISO("2026-08-15"),
});
const aVencer = tx({
  amountCents: 70000,
  type: "SAIDA",
  status: "PENDENTE",
  dueDate: ledgerDayFromISO("2026-08-25"),
});
const paga = tx({
  amountCents: 90000,
  type: "SAIDA",
  status: "LIQUIDADO",
  dueDate: ledgerDayFromISO("2026-08-01"),
});
check("vence antes de hoje = vencida", isOverdue(vencida, HOJE), true);
check("vence depois de hoje = nao", isOverdue(aVencer, HOJE), false);
check("liquidada nunca e vencida", isOverdue(paga, HOJE), false);
check("vence HOJE ainda nao venceu", isOverdue(tx({ amountCents: 1, type: "SAIDA", status: "PENDENTE", dueDate: HOJE }), HOJE), false);

const tv = summarizeTransactions([vencida, aVencer, paga], HOJE);
check("total vencido", tv.overdueExpenseCents, 50000);
check("total a pagar inclui o vencido", tv.pendingExpenseCents, 120000);

console.log("\n== grafico de pizza: so gasto realizado ==");
const cats = [{ id: "c1", name: "Alimentacao", type: "SAIDA" as const, color: "#111" }];
const paraPizza: TransactionLike[] = [
  tx({ amountCents: 30000, type: "SAIDA", status: "LIQUIDADO", categoryId: "c1" }),
  tx({ amountCents: 80000, type: "SAIDA", status: "PENDENTE", categoryId: "c1" }),
  tx({ amountCents: 90000, type: "SAIDA", status: "CANCELADO", categoryId: "c1" }),
  tx({ amountCents: 70000, type: "SAIDA", status: "LIQUIDADO", categoryId: "c1", transferGroupId: "g9" }),
];
const pizza = breakdownByCategory(paraPizza, cats, "SAIDA");
check("so a liquidada e nao-transferencia", pizza[0].totalCents, 30000);
check("uma fatia so", pizza.length, 1);

console.log("\n== fluxo de caixa acompanha o saldo real ==");
const fluxo = buildDailyFlow(lote, 2026, 8, 100000);
const ultimo = fluxo[fluxo.length - 1];
check("saldo acumulado bate com o saldo da conta", ultimo.runningCents, 250000);

console.log("\n== compatibilidade: lancamento sem status (dado antigo) ==");
const antigo = summarizeTransactions(
  [
    { id: "a", date: ledgerDayFromISO("2026-08-05"), description: "x", amountCents: 10000, type: "ENTRADA", accountId: "acc1", categoryId: null },
    { id: "b", date: ledgerDayFromISO("2026-08-06"), description: "y", amountCents: 4000, type: "SAIDA", accountId: "acc1", categoryId: null },
  ],
  HOJE
);
check("sem status = tratado como realizado", [antigo.incomeCents, antigo.expenseCents], [10000, 4000]);
check("nada vira pendente", [antigo.pendingIncomeCents, antigo.pendingExpenseCents], [0, 0]);

console.log("\n== fronteira de fuso: relogio de parede -> dia contabil ==");
// `appNow()` devolve um Date cujos componentes LOCAIS sao o relogio do fuso do
// app. Ler esse Date com getters UTC (o que `startOfLedgerDay` faz, e faz
// certo para datas do banco) daria o dia seguinte numa maquina a oeste de
// Greenwich depois das 21h — e uma conta que vence amanha apareceria vencida.
{
  // Componentes LOCAIS fixos, entao o caso vale em qualquer fuso de maquina.
  const noite = new Date(2026, 7, 24, 21, 30);
  const hoje = ledgerDayFromWallClock(noite);
  check("dia contabil sai do componente local", hoje.toISOString().slice(0, 10), "2026-08-24");

  const venceAmanha = tx({ amountCents: 10000, type: "SAIDA", status: "PENDENTE", dueDate: ledgerDayFromISO("2026-08-25") });
  check("conta de amanha NAO esta vencida", isOverdue(venceAmanha, hoje), false);

  const venceHoje = tx({ amountCents: 10000, type: "SAIDA", status: "PENDENTE", dueDate: ledgerDayFromISO("2026-08-24") });
  check("conta de hoje ainda NAO venceu", isOverdue(venceHoje, hoje), false);

  const venceuOntem = tx({ amountCents: 10000, type: "SAIDA", status: "PENDENTE", dueDate: ledgerDayFromISO("2026-08-23") });
  check("conta de ontem esta vencida", isOverdue(venceuOntem, hoje), true);
}

console.log(fails === 0 ? "\n>>> TODOS PASSARAM\n" : `\n>>> ${fails} FALHA(S)\n`);
process.exit(fails === 0 ? 0 : 1);
