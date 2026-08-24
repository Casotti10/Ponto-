# Financeiro — auditoria e plano de evolução

Levantamento do módulo antes de evoluí-lo para o escopo de gestão financeira
completa. Escrito para ser consultado durante a implementação, etapa por etapa.

---

## 1. Inventário — o que existe hoje

### Dados (`prisma/schema.prisma`)

| Modelo | Campos relevantes |
|---|---|
| `Account` | `name`, `type`, `openingBalanceCents`, `color`, `archived` |
| `Category` | `name`, `type` (ENTRADA/SAIDA), `color`, `archived` |
| `Transaction` | `date`, `description`, `amountCents`, `type`, `notes`, `categoryId`, `accountId`, `recurringId`, `externalId`, `importedAt` |
| `RecurringTransaction` | `frequency`, `dayOfMonth`, `weekday`, `monthOfYear`, `startDate`, `endDate`, `active` |

Enums: `TransactionType{ENTRADA,SAIDA}`, `AccountType{CORRENTE,POUPANCA,CARTEIRA,CARTAO,INVESTIMENTO}`, `RecurrenceFrequency{MENSAL,SEMANAL,ANUAL}`.

> `Goal` existe no schema mas é de **horas** (`targetHours`) — pertence ao módulo
> de ponto. Meta financeira não existe.

### Rotas

- `/financeiro` — visão mensal
- `/financeiro/geral` — histórico completo
- `POST|GET /api/financeiro/import` — importação de extrato

### Camadas

- `src/lib/ledger-calc.ts` — cálculo **puro**, sem banco (totais, fluxo diário, breakdown, saldos, ocorrências de recorrência, formatação)
- `src/lib/ledger-service.ts` — consultas: `getMonthlyLedger`, `getLedgerHistory`, `getBalanceBefore`, `materializeRecurrences`, `ensureLedgerBootstrap`
- `src/lib/actions/ledger.ts` — 10 Server Actions de escrita
- `src/components/ledger/*` — 17 componentes

---

## 2. O que está funcionando — e deve ser preservado

**Separação por período está correta.** É o item 13 da especificação, e já está
resolvido. `getMonthlyLedger` recorta no banco (`date >= início AND date <= fim`,
índice `[userId, date]`), e a visão geral é **rota separada** com paginação real
(`skip`/`take`). Trocar de mês reexecuta o Server Component: lançamento de agosto
nunca chega ao cliente quando a tela está em setembro. Não há filtro visual.

**Fuso resolvido.** `ledgerDayFromISO` grava o dia à meia-noite UTC. É o que
impede um lançamento do dia 1º de cair no mês anterior conforme o fuso do
servidor.

**Totais da visão geral são do conjunto inteiro**, não da página exibida — a
consulta de escopo traz três colunas por linha só para somar.

**Segurança.** Toda leitura e escrita filtra por `userId`; as actions validam que
conta e categoria pertencem ao usuário antes de gravar. Não há como um id
forjado no formulário lançar dinheiro na conta de outra pessoa.

**Auditoria.** `logAudit` em todas as mutações, com `before`/`after`.

**Gráficos são reais**, alimentados por agregação do próprio banco: fluxo diário,
série anual, rosca por categoria, breakdown proporcional. Nenhum dado mockado.

**Recorrências idempotentes** via `@@unique([recurringId, date])`.

**Importação de extrato** OFX/CSV/PDF com deduplicação e categorização
automática.

**Design integrado**: componentes do app, tema claro/escuro, paleta de categorias
verificada para daltonismo com codificação secundária obrigatória.

---

## 3. O que está errado ou ausente

### Bloqueadores — impedem metade da especificação

**3.1 Não existe `status`.** Nenhum campo distingue previsto de realizado. Isso
sozinho inviabiliza: contas a pagar, contas a receber, vencidos, saldo
projetado, alertas de vencimento e boa parte dos insights. Hoje o saldo soma
tudo como se estivesse liquidado — uma despesa lançada para o mês que vem já
reduz o "dinheiro em caixa".

**3.2 Existe uma única data.** `Transaction.date` acumula os três papéis que o
item 35 exige separar: competência, vencimento e pagamento. A conta de energia
de agosto que vence 10/09 e foi paga 08/09 não tem como ser representada.

**3.3 Transferência não existe.** Mover dinheiro entre contas hoje exige duas
transações soltas, e ambas entram nos totais de receita e despesa — inflando os
dois lados e corrompendo o resultado do período.

### Estruturais

| Falta | Consequência |
|---|---|
| Subcategoria | `Category` não tem `parentId` |
| Parcelamento | Não há vínculo entre parcelas de uma mesma compra |
| Forma de pagamento | Campo inexistente |
| Cartão de crédito | `AccountType.CARTAO` existe, mas sem limite, fechamento ou vencimento. Compra no cartão abate o saldo bancário na hora — errado |
| Orçamento | Não existe |
| Meta financeira | Não existe (`Goal` é de horas) |

### Navegação e UX

- O módulo tem **2 rotas**; a especificação pede 9 seções
- Tudo empilhado numa página: contas, categorias, recorrências e gráficos disputam a mesma tela
- Filtros existentes: mês/ano e conta. Faltam categoria, tipo, status, período personalizado e os atalhos (últimos 30 dias, últimos 3 meses, este ano)
- Sem comparativo mensal em tabela, sem insights, sem alertas

---

## 4. Decisões de modelagem

Três escolhas que valem registrar antes de codificar.

**`VENCIDO` é derivado, não armazenado.** Guardar "vencido" como status exigiria
um job para virar o registro à meia-noite, e o dado ficaria errado entre a
virada e a execução. Vencido é `status = PENDENTE AND dueDate < hoje` — calculado
na consulta, sempre correto.

**Transferência são duas pernas, não um terceiro tipo.** Adicionar
`TRANSFERENCIA` a `TransactionType` quebraria todo `switch` exaustivo existente e
ainda deixaria a pergunta "de qual conta para qual". Modelo: duas linhas
(`SAIDA` na origem, `ENTRADA` no destino) unidas por `transferGroupId`, ambas
excluídas dos totais de receita/despesa e ambas contando no saldo da sua conta.
A interface continua oferecendo "Transferência" como tipo — é o que o usuário
pensa; o par é detalhe de implementação.

**Parcela é um lançamento de verdade.** Cada parcela vira uma `Transaction` com
seu próprio vencimento e status, unidas por `installmentGroupId`. Reaproveita a
tabela existente em vez de criar uma paralela, e faz a parcela aparecer
naturalmente no mês dela.

---

## 5. Plano por etapas

Ordenado por dependência: cada etapa destrava a seguinte.

| # | Etapa | Entrega |
|---|---|---|
| 1 | **Fundação de dados** | Migration com `status`, as três datas, transferência, parcelamento, forma de pagamento, subcategoria e campos de cartão. Backfill dos dados existentes |
| 2 | **Regras financeiras** | Saldo real (só liquidado) × projetado; transferência neutra nos totais; cancelamento sem impacto; vencido derivado |
| 3 | **Navegação e Dashboard** | Submenu do módulo; dashboard com os 8 cards, comparativo e fluxo de caixa |
| 4 | **Contas a pagar / a receber** | Duas telas com indicadores, filtros de vencimento e baixa direto na tabela |
| 5 | **Lançamentos** | Tela completa com todos os filtros no backend, paginação, parcelamento e transferência |
| 6 | **Orçamentos e metas** | Dois modelos novos, telas e barras de progresso |
| 7 | **Insights e alertas** | Cálculo sobre os lançamentos reais, sem inventar dado |
| 8 | **Relatórios** | Área dedicada, reaproveitando `export-utils.ts` |

### Compatibilidade do backfill (etapa 1)

Os lançamentos existentes são todos históricos e realizados. O backfill:

- `dueDate = date` e `settledDate = date`
- `status = PAGO` para `SAIDA`, `RECEBIDO` para `ENTRADA`
- `date` passa a significar **competência** (que é o que ele já é na prática)

Nenhuma coluna é removida, nenhum dado é apagado, e o saldo de quem já usa o
módulo não muda depois da migration.

---

## 6. Escopo — nota honesta

A especificação descreve um produto de porte SaaS. As 8 etapas acima não cabem
numa sessão. A ordem foi escolhida para que cada etapa deixe o módulo em estado
funcional e melhor que o anterior — não há ponto intermediário em que o
Financeiro fique quebrado esperando a etapa seguinte.

As etapas 1 e 2 são as que mais mudam o produto: sem `status` e sem separação de
datas, metade da especificação é inalcançável; com elas, o resto vira tela.
