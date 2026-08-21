/**
 * Verificação da separação mensal do razão financeiro.
 *
 * Roda sob vários fusos (TZ=...) porque o bug original era exatamente esse: a
 * escrita resolvia a data no fuso do processo e a leitura montava a janela do
 * mês no fuso do processo, então o resultado dependia de ONDE o código rodou.
 */
import {
  buildDailyFlow,
  formatLedgerDay,
  ledgerDayFromISO,
  ledgerDayToISO,
  ledgerDayOfMonth,
  ledgerMonthOf,
  ledgerMonthRange,
  occurrencesInMonth,
  summarizeTransactions,
  type TransactionLike,
} from "../src/lib/ledger-calc";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`  FALHOU  ${label}\n          esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  }
}

const TZ = process.env.TZ ?? "(padrão do sistema)";
console.log(`\n=== TZ=${TZ} ===`);

/* 1. Um lançamento cai no mês que o usuário digitou --------------------------- */

const casos: { iso: string; ano: number; mes: number }[] = [
  { iso: "2026-08-01", ano: 2026, mes: 8 }, // 1º dia — a borda que vazava para julho
  { iso: "2026-08-15", ano: 2026, mes: 8 },
  { iso: "2026-08-31", ano: 2026, mes: 8 }, // último dia — a borda que vazava para setembro
  { iso: "2026-09-01", ano: 2026, mes: 9 },
  { iso: "2026-09-30", ano: 2026, mes: 9 },
  { iso: "2026-12-31", ano: 2026, mes: 12 }, // virada de ano
  { iso: "2027-01-01", ano: 2027, mes: 1 },
  { iso: "2025-08-10", ano: 2025, mes: 8 }, // mesmo mês, ano diferente
];

for (const caso of casos) {
  const gravado = ledgerDayFromISO(caso.iso);

  // O mês a que o lançamento pertence
  check(`mês de ${caso.iso}`, ledgerMonthOf(gravado), { year: caso.ano, month: caso.mes });

  // Ida e volta: o que foi gravado volta igual para o <input type="date">
  check(`round-trip ${caso.iso}`, ledgerDayToISO(gravado), caso.iso);

  // A janela do mês correspondente CONTÉM o lançamento
  const { start, end } = ledgerMonthRange(caso.ano, caso.mes);
  check(
    `${caso.iso} dentro de ${caso.mes}/${caso.ano}`,
    gravado >= start && gravado <= end,
    true
  );

  // E a janela do mês ANTERIOR e do SEGUINTE não o contêm
  const antesM = caso.mes === 1 ? 12 : caso.mes - 1;
  const antesA = caso.mes === 1 ? caso.ano - 1 : caso.ano;
  const depoisM = caso.mes === 12 ? 1 : caso.mes + 1;
  const depoisA = caso.mes === 12 ? caso.ano + 1 : caso.ano;
  const anterior = ledgerMonthRange(antesA, antesM);
  const seguinte = ledgerMonthRange(depoisA, depoisM);
  check(`${caso.iso} FORA do mês anterior`, gravado >= anterior.start && gravado <= anterior.end, false);
  check(`${caso.iso} FORA do mês seguinte`, gravado >= seguinte.start && gravado <= seguinte.end, false);

  // Agosto/2025 e agosto/2026 são períodos distintos
  const outroAno = ledgerMonthRange(caso.ano - 1, caso.mes);
  check(`${caso.iso} FORA do mesmo mês do ano anterior`, gravado >= outroAno.start && gravado <= outroAno.end, false);
}

/* 2. As janelas de meses vizinhos não se sobrepõem nem deixam buraco ---------- */

for (let mes = 1; mes <= 11; mes++) {
  const a = ledgerMonthRange(2026, mes);
  const b = ledgerMonthRange(2026, mes + 1);
  check(`janela ${mes}→${mes + 1} sem sobreposição/buraco`, b.start.getTime() - a.end.getTime(), 1);
}

/* 3. O dia exibido é o dia digitado ------------------------------------------ */

check("dia do mês de 2026-08-01", ledgerDayOfMonth(ledgerDayFromISO("2026-08-01")), 1);
check("dia do mês de 2026-08-31", ledgerDayOfMonth(ledgerDayFromISO("2026-08-31")), 31);
check("rótulo de 2026-08-01", formatLedgerDay(ledgerDayFromISO("2026-08-01")), "01 de ago");
check("rótulo de 2026-12-31", formatLedgerDay(ledgerDayFromISO("2026-12-31")), "31 de dez");

/* 4. Totais e fluxo diário do mês -------------------------------------------- */

const agosto: TransactionLike[] = [
  { id: "1", date: ledgerDayFromISO("2026-08-01"), description: "Salário", amountCents: 500000, type: "ENTRADA", accountId: "a", categoryId: "sal" },
  { id: "2", date: ledgerDayFromISO("2026-08-01"), description: "Aluguel", amountCents: 180000, type: "SAIDA", accountId: "a", categoryId: "mor" },
  { id: "3", date: ledgerDayFromISO("2026-08-15"), description: "Mercado", amountCents: 50000, type: "SAIDA", accountId: "a", categoryId: "ali" },
  { id: "4", date: ledgerDayFromISO("2026-08-31"), description: "Transporte", amountCents: 20000, type: "SAIDA", accountId: "a", categoryId: "tra" },
];

const totais = summarizeTransactions(agosto);
check("entradas de agosto", totais.incomeCents, 500000);
check("saídas de agosto", totais.expenseCents, 250000);
check("saldo de agosto", totais.balanceCents, 250000);
check("quantidade de lançamentos", totais.transactionCount, 4);

const fluxo = buildDailyFlow(agosto, 2026, 8, 0);
check("agosto tem 31 dias", fluxo.length, 31);
check("dia 1 — entradas", fluxo[0].incomeCents, 500000);
check("dia 1 — saídas", fluxo[0].expenseCents, 180000);
check("dia 15 — saídas", fluxo[14].expenseCents, 50000);
check("dia 31 — saídas", fluxo[30].expenseCents, 20000);
check("saldo acumulado no fim do mês", fluxo[30].runningCents, 250000);

// Fevereiro de ano bissexto vs. comum
check("fev/2028 tem 29 dias", buildDailyFlow([], 2028, 2, 0).length, 29);
check("fev/2026 tem 28 dias", buildDailyFlow([], 2026, 2, 0).length, 28);

/* 5. Recorrências caem no mês certo ------------------------------------------ */

const aluguel = {
  id: "r1",
  frequency: "MENSAL" as const,
  dayOfMonth: 5,
  weekday: 1,
  monthOfYear: 1,
  startDate: ledgerDayFromISO("2026-01-01"),
  endDate: null,
  active: true,
};

const emAgosto = occurrencesInMonth(aluguel, 2026, 8);
check("aluguel gera 1 ocorrência em agosto", emAgosto.length, 1);
check("aluguel cai em 05/08/2026", ledgerDayToISO(emAgosto[0]), "2026-08-05");
check("aluguel de agosto pertence a agosto", ledgerMonthOf(emAgosto[0]), { year: 2026, month: 8 });

const emSetembro = occurrencesInMonth(aluguel, 2026, 9);
check("aluguel cai em 05/09/2026", ledgerDayToISO(emSetembro[0]), "2026-09-05");

// Dia 31 num mês de 30 dias cai no último dia, não pula o mês
const dia31 = { ...aluguel, dayOfMonth: 31 };
check("dia 31 em setembro vira 30/09", ledgerDayToISO(occurrencesInMonth(dia31, 2026, 9)[0]), "2026-09-30");
check("dia 31 em fevereiro vira 28/02", ledgerDayToISO(occurrencesInMonth(dia31, 2026, 2)[0]), "2026-02-28");

// Antes do início não gera
const futura = { ...aluguel, startDate: ledgerDayFromISO("2026-10-01") };
check("recorrência futura não gera em agosto", occurrencesInMonth(futura, 2026, 8).length, 0);
check("recorrência futura gera em outubro", occurrencesInMonth(futura, 2026, 10).length, 1);

// Inativa não gera
check("recorrência inativa não gera", occurrencesInMonth({ ...aluguel, active: false }, 2026, 8).length, 0);

/* 6. Regressão: a convenção ANTIGA falhava neste mesmo cenário ---------------- */

// Como era antes: data resolvida no fuso do processo, janela idem.
const antigoGravado = new Date("2026-08-01T00:00:00");
const antigaJanelaStart = new Date(2026, 7, 1);
const mesmoFuso = antigoGravado >= antigaJanelaStart;
// Dentro do MESMO fuso a convenção antiga funcionava — por isso o bug era
// intermitente. O que ela não suportava era escrita e leitura em fusos
// diferentes (produção em UTC, consulta local), simulado abaixo.
const gravadoEmUTC = new Date(Date.UTC(2026, 7, 1)); // 2026-08-01T00:00:00Z, como a Vercel gravava
const janelaLocalAgosto = new Date(2026, 7, 1); // início de agosto no fuso do processo
const antigoVazaria = gravadoEmUTC < janelaLocalAgosto;

console.log(`  [contexto] convenção antiga, mesmo fuso: ${mesmoFuso ? "ok" : "FALHA"}`);
console.log(
  `  [contexto] convenção antiga, gravado em UTC e lido em ${TZ}: ${
    antigoVazaria ? "VAZARIA para julho" : "ok"
  }`
);

// A nova convenção não vaza em fuso nenhum:
const novoGravado = ledgerDayFromISO("2026-08-01");
const novaJanela = ledgerMonthRange(2026, 8);
check("convenção nova não vaza neste fuso", novoGravado >= novaJanela.start, true);

console.log(`  ${checks - failures}/${checks} verificações passaram`);
if (failures > 0) {
  console.log(`  ${failures} FALHA(S)`);
  process.exitCode = 1;
}
