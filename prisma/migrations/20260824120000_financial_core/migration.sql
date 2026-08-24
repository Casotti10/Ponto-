-- Fundacao do modulo financeiro completo: situacao do lancamento, separacao das
-- tres datas, transferencia, parcelamento, subcategoria e cartao de credito.
--
-- Migration ADITIVA: nenhuma coluna e removida, nenhum dado e apagado, e o saldo
-- de quem ja usa o modulo nao muda depois de aplicada.

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDENTE', 'LIQUIDADO', 'AGENDADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA', 'OUTRO');

-- AlterTable: Transaction
-- O DEFAULT 'LIQUIDADO' faz as linhas existentes nascerem ja liquidadas. E o
-- que preserva o comportamento anterior: antes desta coluna todo lancamento
-- contava no saldo, e a migration nao pode mexer no saldo de ninguem.
ALTER TABLE "Transaction"
  ADD COLUMN "status" "TransactionStatus" NOT NULL DEFAULT 'LIQUIDADO',
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "settledDate" TIMESTAMP(3),
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "transferGroupId" TEXT,
  ADD COLUMN "installmentGroupId" TEXT,
  ADD COLUMN "installmentNumber" INTEGER,
  ADD COLUMN "installmentTotal" INTEGER;

-- Backfill das datas. Os lancamentos existentes sao todos historicos e
-- realizados, entao competencia, vencimento e liquidacao coincidem. Preencher
-- em vez de deixar NULL faz o indice (userId, status, dueDate) servir as
-- consultas de contas a pagar/receber sem precisar de COALESCE.
UPDATE "Transaction" SET "dueDate" = "date", "settledDate" = "date";

-- AlterTable: Category (subcategoria)
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;

-- AlterTable: Account (cartao de credito)
-- Nulos, e nao zero: "sem limite cadastrado" nao pode se confundir com
-- "limite zero".
ALTER TABLE "Account"
  ADD COLUMN "creditLimitCents" INTEGER,
  ADD COLUMN "closingDay" INTEGER,
  ADD COLUMN "dueDay" INTEGER;

-- CreateIndex
CREATE INDEX "Transaction_userId_status_dueDate_idx" ON "Transaction"("userId", "status", "dueDate");
CREATE INDEX "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");
CREATE INDEX "Transaction_installmentGroupId_idx" ON "Transaction"("installmentGroupId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
