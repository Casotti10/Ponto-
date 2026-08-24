-- Orcamento mensal por categoria e metas financeiras.
-- Migration aditiva: cria duas tabelas novas e nao toca em nada existente.

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "limitCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetCents" INTEGER NOT NULL,
    "currentCents" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "color" TEXT NOT NULL DEFAULT '#2a78d6',
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Budget_userId_year_month_idx" ON "Budget"("userId", "year", "month");
CREATE UNIQUE INDEX "Budget_userId_categoryId_year_month_key" ON "Budget"("userId", "categoryId", "year", "month");
CREATE INDEX "FinancialGoal_userId_archived_idx" ON "FinancialGoal"("userId", "archived");

-- CreateIndex (parcial)
-- O indice unico acima NAO cobre o orcamento TOTAL do mes (categoryId nulo):
-- no Postgres dois NULL nao sao iguais, entao nada impediria dois orcamentos
-- totais para o mesmo mes. Este indice parcial garante exatamente um.
CREATE UNIQUE INDEX "Budget_total_per_month_key"
  ON "Budget"("userId", "year", "month")
  WHERE "categoryId" IS NULL;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
