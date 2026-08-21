-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3);

-- CreateIndex
-- No Postgres dois NULL nao sao considerados iguais, entao esta restricao nao
-- atinge os lancamentos digitados a mao (externalId nulo): ela so impede que o
-- mesmo lancamento de extrato entre duas vezes na mesma conta.
CREATE UNIQUE INDEX "Transaction_accountId_externalId_key" ON "Transaction"("accountId", "externalId");

-- CreateIndex
CREATE INDEX "Transaction_userId_importedAt_idx" ON "Transaction"("userId", "importedAt");
