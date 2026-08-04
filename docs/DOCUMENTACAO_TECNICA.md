# 📘 Documentação Técnica Completa - Ponto+

**Versão**: 0.1.0  
**Data**: 04/08/2026  
**Autor**: Lucas Casotti  
**Status**: ✅ Em Produção

---

## 📋 Índice de Navegação

1. [Visão Geral](#visão-geral)
2. [Tecnologias Utilizadas](#tecnologias-utilizadas)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Arquitetura do Sistema](#arquitetura-do-sistema)
5. [Banco de Dados](#banco-de-dados)
6. [Rotas da Aplicação](#rotas-da-aplicação)
7. [Autenticação e Segurança](#autenticação-e-segurança)
8. [Módulo de Ponto (Time Entry)](#módulo-de-ponto)
9. [Módulo Financeiro](#módulo-financeiro)
10. [Componentes Principais](#componentes-principais)
11. [Como Alterar Manualmente](#como-alterar-manualmente)
12. [Testes Locais](#testes-locais)
13. [Deploy](#deploy)
14. [Integrações Futuras](#integrações-futuras)
15. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

### O que é Ponto+?

**Ponto+** é uma aplicação web moderna para controle de ponto e gestão financeira pessoal/empresarial. Permite que funcionários registrem suas entradas e saídas, gerenciem banco de horas, acompanhem férias/ausências, e monitorem fluxo de caixa e despesas.

### Problema que Resolve

- ❌ **Antes**: Planilhas Excel desorganizadas, cálculos manuais propensos a erros
- ✅ **Depois**: Sistema centralizado, cálculos automáticos, relatórios em tempo real

### Público-Alvo

- 👥 Empresas (pequenas, médias e grandes)
- 👤 Funcionários que precisam registrar ponto
- 👨‍💼 Gerentes/Administradores
- 💰 Indivíduos que querem controlar finanças pessoais

### Funcionalidades Principais

```
┌─ Controle de Ponto
│  ├── Registro entrada/saída em tempo real
│  ├── Banco de horas automático
│  ├── Relatórios de jornada
│  └── Histórico completo
│
├─ Gestão de Ausências
│  ├── Faltas (justificadas/injustificadas)
│  ├── Férias, licenças, home office
│  └── Impacto automático no saldo
│
├─ Dashboard Financeiro
│  ├── Entradas vs Saídas
│  ├── Múltiplas contas/bancos
│  ├── Fluxo de caixa mensal
│  └── Taxa de poupança
│
└─ Relatórios e Exportação
   ├── PDF
   ├── Excel
   └── Filtros avançados
```

---

## 🛠️ Tecnologias Utilizadas

### Frontend

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| **React** | 19.2.4 | Framework UI com hooks modernos |
| **Next.js** | 16.2.11 | SSR, Server Components, App Router |
| **TypeScript** | 5.x | Type-safety em todo código |
| **Tailwind CSS** | 4.x | Styling utilitário, dark mode nativo |
| **React Hook Form** | 7.82.0 | Gerenciamento de formulários |
| **Zod** | 4.4.3 | Validação de schemas |
| **Recharts** | 3.10.0 | Gráficos de dados |
| **date-fns** | 4.4.0 | Manipulação de datas |
| **Lucide React** | 1.25.0 | Ícones SVG |

### Backend

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| **Next.js API Routes** | 16.2.11 | Server Actions para operações |
| **Prisma ORM** | 6.19.3 | Acesso a banco de dados |
| **bcryptjs** | 3.0.3 | Hash de senhas (NIST SP 800-63B) |
| **jsonwebtoken** | 9.0.3 | JWT para autenticação |

### Banco de Dados

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| **PostgreSQL** | Neon Serverless | Banco principal |
| **PgBouncer** | Neon | Connection pooling |

### DevOps / Deploy

| Tecnologia | Uso |
|-----------|-----|
| **Vercel** | Deploy automático via Git |
| **GitHub** | Versionamento e CI/CD |
| **Docker** | Containerização (opcional) |

---

## 📁 Estrutura do Projeto

```
ponto/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (app)/                   # Rotas protegidas (layout wrapper)
│   │   │   ├── dashboard/           # Dashboard principal
│   │   │   ├── ponto/               # Controle de ponto
│   │   │   ├── ausencias/           # Gestão de ausências
│   │   │   ├── banco-horas/         # Saldo de banco de horas
│   │   │   ├── financeiro/          # Dashboard financeiro
│   │   │   ├── historico/           # Histórico de ponto
│   │   │   ├── relatorios/          # Exportação de relatórios
│   │   │   ├── calendario/          # Calendário
│   │   │   ├── pesquisa/            # Busca global
│   │   │   ├── configuracoes/       # Perfil e preferências
│   │   │   └── layout.tsx           # Layout principal com sidebar
│   │   ├── login/                   # Página de login (pública)
│   │   ├── cadastro/                # Página de cadastro (pública)
│   │   ├── page.tsx                 # Página inicial (redireciona)
│   │   ├── layout.tsx               # Layout raiz
│   │   └── _not-found/              # Página 404
│   │
│   ├── components/                   # Componentes React reutilizáveis
│   │   ├── ui/                      # Componentes base (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── command.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ... (outros)
│   │   │
│   │   ├── layout/                  # Componentes de layout
│   │   │   ├── header.tsx           # Cabeçalho com navegação
│   │   │   ├── sidebar-nav.tsx      # Sidebar com menu
│   │   │   ├── theme-toggle.tsx     # Botão dark/light mode
│   │   │   ├── notification-bell.tsx# Bell de notificações
│   │   │   └── nav-items.ts         # Configuração do menu
│   │   │
│   │   ├── dashboard/               # Componentes do dashboard
│   │   │   ├── stat-card.tsx        # Card de estatísticas
│   │   │   ├── daily-balance-chart.tsx
│   │   │   └── balance-trend-chart.tsx
│   │   │
│   │   ├── timeentry/               # Componentes de ponto
│   │   │   ├── time-entry-form-dialog.tsx
│   │   │   ├── entry-row-actions.tsx
│   │   │   ├── quick-punch.tsx      # Entrada rápida
│   │   │   └── ...
│   │   │
│   │   ├── absences/                # Componentes de ausências
│   │   │   ├── absence-form-dialog.tsx
│   │   │   ├── absence-row-actions.tsx
│   │   │   └── ...
│   │   │
│   │   ├── ledger/                  # Componentes financeiros
│   │   │   ├── transaction-form-dialog.tsx
│   │   │   ├── cashflow-chart.tsx
│   │   │   ├── category-breakdown.tsx
│   │   │   ├── account-filter.tsx   # Filtro por conta
│   │   │   ├── monthly-summary.tsx  # Resumo mensal
│   │   │   ├── accounts-manager.tsx # Gestão de contas
│   │   │   ├── categories-manager.tsx
│   │   │   ├── recurring-manager.tsx
│   │   │   └── ...
│   │   │
│   │   ├── settings/                # Componentes de configurações
│   │   │   ├── profile-form-dialog.tsx
│   │   │   ├── work-schedule-form.tsx
│   │   │   ├── goals-manager.tsx
│   │   │   └── ...
│   │   │
│   │   ├── reports/                 # Componentes de relatórios
│   │   │   ├── export-buttons.tsx
│   │   │   ├── report-range-picker.tsx
│   │   │   └── ...
│   │   │
│   │   ├── theme-provider.tsx       # Provider do tema
│   │   ├── pwa-register.tsx         # Registro de PWA
│   │   └── animated-flag.tsx        # Bandeira animada
│   │
│   ├── lib/                          # Lógica de negócio e utilitários
│   │   ├── actions/                 # Server Actions
│   │   │   ├── auth.ts              # Login, logout, cadastro
│   │   │   ├── time-entries.ts      # CRUD de ponto
│   │   │   ├── absences.ts          # CRUD de ausências
│   │   │   ├── balance.ts           # Cálculos de saldo
│   │   │   ├── ledger.ts            # CRUD de transações
│   │   │   ├── settings.ts          # Preferências do usuário
│   │   │   └── notifications.ts     # Sistema de notificações
│   │   │
│   │   ├── time-calc.ts             # Cálculos de horas e jornada
│   │   ├── ledger-calc.ts           # Cálculos financeiros
│   │   ├── ledger-service.ts        # Lógica de serviço do financeiro
│   │   ├── time-service.ts          # Lógica de serviço de ponto
│   │   ├── auth.ts                  # Lógica de autenticação
│   │   ├── validations.ts           # Schemas Zod de validação
│   │   ├── utils.ts                 # Utilitários gerais (cn, etc)
│   │   ├── chart-colors.ts          # Configuração de cores dos gráficos
│   │   ├── export-utils.ts          # Funções de exportação (PDF, Excel)
│   │   ├── audit.ts                 # Auditoria de ações
│   │   ├── use-mounted.ts           # Hook customizado
│   │   └── prisma.ts                # Cliente Prisma singleton
│   │
│   └── env.ts                        # Validação de variáveis de ambiente
│
├── prisma/
│   ├── schema.prisma                # Definição do banco de dados
│   ├── migrations/                  # Histórico de migrações
│   └── seed.ts                      # Script de seed (dados iniciais)
│
├── public/                           # Arquivos estáticos
│   ├── favicon.ico
│   ├── manifest.json                # Manifesto PWA
│   └── ...
│
├── docs/                            # Documentação
│   ├── PREVIEW_MONTHLY_SUMMARY.md
│   ├── SUMARIO_MELHORIAS_DASHBOARD.md
│   └── DOCUMENTACAO_TECNICA.md       # Este arquivo
│
├── .env.example                     # Exemplo de variáveis de ambiente
├── next.config.ts                   # Configuração do Next.js
├── tailwind.config.ts               # Configuração do Tailwind
├── tsconfig.json                    # Configuração do TypeScript
├── prisma.config.ts                 # Configuração do Prisma
├── package.json                     # Dependências e scripts
├── eslintrc.json                    # Configuração do ESLint
├── vercel.json                      # Configuração de deploy Vercel
├── DOCUMENTACAO_TECNICA.md           # Documentação (este arquivo)
└── README.md                        # Readme do projeto
```

### Explicação das Pastas Principais

#### `src/app` - Next.js App Router

Cada pasta em `app/` representa uma rota. O prefixo `(app)` é um **route group** que agrupa rotas relacionadas sem afetar a URL final.

- `(app)` = rotas protegidas (requer autenticação)
- Fora de `(app)` = rotas públicas (login, cadastro)

#### `src/components` - Componentes Reutilizáveis

Componentes organizados por feature/domínio:
- `ui/` = componentes base (Buttons, Cards, etc) — não têm lógica
- `layout/` = componentes de estrutura (Header, Sidebar)
- `dashboard/`, `timeentry/`, `ledger/` = componentes específicos do domínio

#### `src/lib` - Lógica de Negócio

- `actions/` = Server Actions (funções executadas no servidor)
- `*-calc.ts` = Cálculos puros (sem side effects)
- `*-service.ts` = Lógica de serviço (orquestra múltiplas operações)
- `validations.ts` = Schemas Zod para validação

#### `prisma/` - Banco de Dados

- `schema.prisma` = Definição de todas as tabelas
- `migrations/` = Histórico de mudanças no banco
- `seed.ts` = Dados iniciais para desenvolvimento

---

## 🏗️ Arquitetura do Sistema

### Diagrama de Fluxo de Dados

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR DO USUÁRIO                 │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │           React Client Components (TSX)            │ │
│  │                                                    │ │
│  │  • Dashboard • Formulários • Tabelas • Gráficos  │ │
│  └────────────┬─────────────────────────────────────┘ │
│               │                                        │
│               │  useState, useTransition              │
│               │  useRouter, useSearchParams            │
│               │                                        │
└───────────────┼────────────────────────────────────────┘
                │
                │ HTTP (JSON)
                │
    ┌───────────▼────────────────┐
    │   Next.js Server (Node.js)   │
    │                             │
    │  ┌─────────────────────┐   │
    │  │   Server Actions     │   │
    │  │  (lib/actions/*.ts)  │   │
    │  │                      │   │
    │  │  • loginAction()     │   │
    │  │  • createTimeEntry() │   │
    │  │  • createTransaction()│  │
    │  └──────────┬───────────┘   │
    │             │               │
    │  ┌──────────▼───────────┐   │
    │  │  Prisma ORM           │   │
    │  │  (schema.prisma)      │   │
    │  │                       │   │
    │  │  • user.create()      │   │
    │  │  • timeEntry.create() │   │
    │  │  • transaction.create()│  │
    │  └──────────┬────────────┘   │
    │             │                │
    └─────────────┼────────────────┘
                  │
                  │ TCP/IP
                  │
        ┌─────────▼──────────┐
        │   PostgreSQL       │
        │   (Neon Serverless)│
        │                    │
        │  • users           │
        │  • time_entries    │
        │  • absences        │
        │  • transactions    │
        │  • accounts        │
        │  • audit_logs      │
        └────────────────────┘
```

### Padrões de Arquitetura

#### 1. **Server Components + Client Components**

```typescript
// ✅ Server Component (padrão)
// Renderiza no servidor, sem JavaScript no cliente
export default async function Page() {
  const data = await db.query(); // OK - acesso direto ao DB
  return <ClientComponent data={data} />;
}

// ✅ Client Component (quando precisa interatividade)
// "use client" - executa no navegador
export function ClientComponent({ data }) {
  const [state, setState] = useState(data);
  return <div>{state}</div>;
}
```

#### 2. **Server Actions**

```typescript
// lib/actions/time-entries.ts
"use server";

export async function createTimeEntry(formData: FormData) {
  const entry = await db.timeEntry.create({...});
  revalidatePath("/ponto"); // Recarrega cache
  return entry;
}
```

#### 3. **Validação em Camadas**

```
Cliente (Zod) → Servidor (Zod) → Banco de Dados (Prisma constraints)
```

#### 4. **Separação de Responsabilidades**

```
UI Layer (components/)
    ↓
Logic Layer (lib/actions/, lib/*-service.ts)
    ↓
Database Layer (Prisma ORM)
    ↓
Database (PostgreSQL)
```

---

## 💾 Banco de Dados

### Schema Principal

#### Tabela: `users`

```prisma
model User {
  id String @id @default(cuid())
  email String @unique
  password String // bcrypt hash
  name String
  role Role // ADMIN, MANAGER, EMPLOYEE
  workScheduleId String? @unique
  workSchedule WorkSchedule?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relações
  timeEntries TimeEntry[]
  absences Absence[]
  balanceAdjustments BalanceAdjustment[]
  transactions Transaction[]
  accounts Account[]
  goals Goal[]
  auditLogs AuditLog[]
}
```

#### Tabela: `time_entries`

Registra cada entrada/saída do usuário.

```prisma
model TimeEntry {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id])
  
  date DateTime // Data do registro
  type EntryType // ENTRADA, SAIDA_ALMOCO, RETORNO_ALMOCO, SAIDA
  time DateTime // Data + hora exata
  source EntrySource // MANUAL, PONTO_RAPIDO, IMPORTACAO, AJUSTE
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId, date])
}

enum EntryType {
  ENTRADA
  SAIDA_ALMOCO
  RETORNO_ALMOCO
  SAIDA
}
```

#### Tabela: `absences`

Registra faltas, férias, licenças, etc.

```prisma
model Absence {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id])
  
  type AbsenceType // FALTA_JUSTIFICADA, FERIAS, LICENCA, HOME_OFFICE
  dateStart DateTime // Início
  dateEnd DateTime // Fim
  impact AbsenceImpact // Como afeta o saldo
  reason String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId, dateStart])
}

enum AbsenceType {
  FALTA_JUSTIFICADA
  FALTA_INJUSTIFICADA
  BANCO_HORAS
  FOLGA
  FERIAS
  LICENCA
  COMPENSACAO
  HOME_OFFICE
}

enum AbsenceImpact {
  NEUTRO // férias, licença = não afeta
  DESCONTA // falta injustificada = desconta saldo
  ABATE_BANCO // banco de horas, compensação = usa crédito
  NAO_DESCONTA // falta justificada = não afeta
}
```

#### Tabela: `balance_adjustments`

Ajustes manuais no saldo.

```prisma
model BalanceAdjustment {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id])
  
  datePeriod DateTime // Mês/ano do ajuste
  type AdjustmentType // MANUAL_ADD, MANUAL_REMOVE, FECHAMENTO_MENSAL, CORRECAO
  hoursMinutes String // Formato: "02:30" (2h30min)
  reason String
  
  createdAt DateTime @default(now())
  
  @@index([userId, datePeriod])
}

enum AdjustmentType {
  MANUAL_ADD
  MANUAL_REMOVE
  FECHAMENTO_MENSAL
  CORRECAO
}
```

#### Tabela: `transactions` (Módulo Financeiro)

```prisma
model Transaction {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id])
  accountId String
  account Account @relation(fields: [accountId], references: [id])
  categoryId String?
  category Category? @relation(fields: [categoryId], references: [id])
  
  type TransactionType // ENTRADA, SAIDA
  description String
  amountCents Int // Armazenar em centavos para evitar arredondamento
  date DateTime
  
  isRecurring Boolean @default(false)
  recurringId String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([userId, accountId, date])
}

enum TransactionType {
  ENTRADA
  SAIDA
}
```

#### Tabela: `accounts` (Contas Bancárias)

```prisma
model Account {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id])
  
  name String // "Nubank", "Itaú", "Carteira"
  type AccountType // CORRENTE, POUPANCA, CARTEIRA
  color String // Hex color para identificação visual
  balance Int // Saldo em centavos
  archived Boolean @default(false)
  
  transactions Transaction[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum AccountType {
  CORRENTE
  POUPANCA
  CARTEIRA
}
```

### Relacionamentos Principais

```
User 1 ──────── * TimeEntry
User 1 ──────── * Absence
User 1 ──────── * Transaction
User 1 ──────── * Account
User 1 ──────── * BalanceAdjustment
Account 1 ──────── * Transaction
Category 1 ──────── * Transaction
WorkSchedule 1 ──── 1 User (opcional)
```

### Como Consultar o Banco Localmente

```bash
# Abrir Prisma Studio (UI visual)
npm run db:studio

# Fazer query via Prisma Client
npx prisma db execute --stdin < query.sql
```

---

## 🛣️ Rotas da Aplicação

### Rotas Públicas (sem autenticação)

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/` | `src/app/page.tsx` | Página inicial (redireciona para login ou dashboard) |
| `/login` | `src/app/login/page.tsx` | Formulário de login |
| `/cadastro` | `src/app/cadastro/page.tsx` | Formulário de cadastro |

### Rotas Protegidas (com autenticação)

Todas as rotas abaixo requerem JWT válido. Layout: `src/app/(app)/layout.tsx`

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/dashboard` | `dashboard/page.tsx` | Dashboard principal com KPIs |
| `/ponto` | `ponto/page.tsx` | Registro e histórico de ponto |
| `/ausencias` | `ausencias/page.tsx` | Gestão de faltas, férias, licenças |
| `/banco-horas` | `banco-horas/page.tsx` | Saldo de banco de horas |
| `/financeiro` | `financeiro/page.tsx` | Dashboard financeiro, transações |
| `/historico` | `historico/page.tsx` | Histórico de ponto com filtros |
| `/relatorios` | `relatorios/page.tsx` | Exportação de dados (PDF, Excel) |
| `/calendario` | `calendario/page.tsx` | Calendário visual |
| `/pesquisa` | `pesquisa/page.tsx` | Busca global |
| `/configuracoes` | `configuracoes/page.tsx` | Perfil, jornada, preferências |

### Estrutura de URL

```
/login                           # Pública
/cadastro                        # Pública
/(app)/dashboard                 # Protegida
/(app)/ponto                     # Protegida
/(app)/ponto?date=2024-08-01     # Com query params
/(app)/financeiro?month=8&year=2024 # Filtros
/(app)/financeiro?accountId=xxx&month=8
```

---

## 🔐 Autenticação e Segurança

### Fluxo de Autenticação

```
1. Usuário acessa /login
2. Entra email + senha
3. loginAction() é chamada (Server Action)
4. Senha é validada com bcrypt
5. JWT token é criado e armazenado no cookie
6. Usuário é redirecionado para /dashboard
7. A cada requisição, o JWT é validado
8. Se expirou, usuário é redirecionado para /login
```

### Validação de Senha (NIST SP 800-63B)

Implementada em `src/lib/validations.ts`:

```typescript
export const strongPasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Máximo 72 caracteres (limite bcrypt)")
  .refine(
    (password) => {
      // Deve ter 4 classes de caracteres
      const lowercase = /[a-z]/.test(password);
      const uppercase = /[A-Z]/.test(password);
      const digit = /[0-9]/.test(password);
      const special = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
      
      return lowercase && uppercase && digit && special;
    },
    "Deve conter minúsculas, maiúsculas, números e símbolos"
  )
  .refine(
    (password) => !password.toLowerCase().includes(user.email.split("@")[0]),
    "Não pode conter seu email"
  );
```

### Tokens JWT

**Criação**: `src/lib/auth.ts`

```typescript
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET!,
  { expiresIn: "7d" }
);
```

**Validação**:

```typescript
// Middleware automático: cada Server Action valida o token
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### Proteção de Dados Sensíveis

| Dado | Proteção | Arquivo |
|------|----------|---------|
| Senhas | bcrypt (hashing) | `auth.ts` |
| Tokens | JWT assinado | `auth.ts` |
| Variáveis de ambiente | `.env` (gitignore) | `.env.example` |
| Email do usuário | Campo único no DB | `schema.prisma` |

### Auditoria

Todas as ações sensíveis são registradas:

```prisma
model AuditLog {
  id String @id @default(cuid())
  userId String
  action AuditAction // CREATE, UPDATE, DELETE, ADJUST, CLOSE_MONTH
  entity AuditEntity // TIME_ENTRY, TRANSACTION, USER, etc
  entityId String // ID do registro afetado
  changes Json? // O que mudou
  createdAt DateTime @default(now())
}
```

Como registrar uma ação:

```typescript
import { audit } from "@/lib/audit";

export async function createTimeEntry(data) {
  const entry = await db.timeEntry.create({ data });
  
  await audit({
    userId: user.id,
    action: "CREATE",
    entity: "TIME_ENTRY",
    entityId: entry.id,
  });
  
  return entry;
}
```

---

## 📊 Módulo de Ponto

### Fluxo Básico

```
Usuário clica "Registrar Ponto"
        ↓
Componente QuickPunch abre (dialog)
        ↓
Usuário confirma entrada/saída
        ↓
timeentryAction() é chamada (Server Action)
        ↓
TimeEntry é criado no banco
        ↓
Auditoria é registrada
        ↓
UI é recarregada (revalidatePath)
        ↓
Notificação de sucesso é exibida
```

### Tipos de Entrada

| Tipo | Código | Significado |
|------|--------|-----------|
| Entrada | `ENTRADA` | Chegada do dia |
| Saída Almoço | `SAIDA_ALMOCO` | Saída para almoço |
| Retorno Almoço | `RETORNO_ALMOCO` | Volta do almoço |
| Saída | `SAIDA` | Saída do dia |

### Cálculo de Jornada

`src/lib/time-calc.ts`:

```typescript
export function calculateDailyBalance(entries: TimeEntry[], workSchedule) {
  // 1. Ordena entries por hora
  const sorted = entries.sort((a, b) => a.time - b.time);
  
  // 2. Calcula períodos
  // ENTRADA → SAIDA_ALMOCO = período 1
  // RETORNO_ALMOCO → SAIDA = período 2
  
  // 3. Subtrai intervalo de almoço
  // 4. Compara com jornada esperada (workSchedule)
  
  // 5. Retorna diferença (+horas positivas, -horas negativas)
  return { hours: 8, minutes: 30, balance: "00:30" };
}
```

### Exemplos de Uso

#### Criar um Registro de Ponto

**Onde alterar**: `src/lib/actions/time-entries.ts`

```typescript
export async function createTimeEntryAction(data: {
  type: EntryType;
  date: Date;
}) {
  const user = await getCurrentUser(); // Valida JWT
  
  // Validação
  if (!user) throw new Error("Não autenticado");
  
  // Criar
  const entry = await db.timeEntry.create({
    data: {
      userId: user.id,
      type: data.type,
      time: data.date,
      date: new Date(data.date), // Apenas data
      source: "MANUAL",
    },
  });
  
  // Auditoria
  await audit({
    userId: user.id,
    action: "CREATE",
    entity: "TIME_ENTRY",
    entityId: entry.id,
  });
  
  // Invalida cache
  revalidatePath("/ponto");
  revalidatePath("/dashboard");
  
  return entry;
}
```

**Como chamar do cliente**:

```typescript
"use client";
import { createTimeEntryAction } from "@/lib/actions/time-entries";

export function QuickPunch() {
  const [isPending, startTransition] = useTransition();
  
  async function handlePunch() {
    startTransition(async () => {
      const result = await createTimeEntryAction({
        type: "ENTRADA",
        date: new Date(),
      });
      
      toast.success("Ponto registrado!");
    });
  }
  
  return <button onClick={handlePunch}>{isPending ? "..." : "Entrada"}</button>;
}
```

---

## 💰 Módulo Financeiro

### Estrutura de Dados

```
Account (Conta Bancária)
    ├── name: "Nubank"
    ├── type: "CORRENTE"
    ├── color: "#2a78d6" (azul)
    └── balance: 500000 (em centavos = R$ 5.000,00)
    
Transaction (Transação)
    ├── description: "Supermercado"
    ├── type: "SAIDA"
    ├── amountCents: 15000 (= R$ 150,00)
    ├── date: "2024-08-01"
    ├── account: Account
    └── category: Category (opcional)

Category (Categoria)
    ├── name: "Alimentação"
    ├── color: "#ff6b6b"
    └── emoji: "🍕"
```

### Fluxo de Adição de Transação

```
1. Usuário clica "+ Nova Transação"
2. Dialog abre com formulário
3. Usuário preenche:
   - Descrição (ex: "Supermercado")
   - Valor (ex: "R$ 150,00")
   - Tipo (Entrada/Saída)
   - Conta (Nubank, Itaú, etc)
   - Categoria (opcional)
   - Data
4. Validação Zod no cliente
5. Server Action createTransactionAction() é chamada
6. Validação Zod no servidor
7. Transação é criada no DB
8. Saldo da conta é atualizado
9. Cache é revalidado
10. Tabela é recarregada
11. Toast de sucesso
```

### Cálculos Financeiros

`src/lib/ledger-calc.ts`:

```typescript
export interface PeriodTotals {
  incomeCents: number; // Todas as ENTRADA do período
  expenseCents: number; // Todas as SAIDA do período
  balanceCents: number; // income - expense
  savingsRate: number; // (balance / income) * 100
}

export function calculatePeriodTotals(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): PeriodTotals {
  const filtered = transactions.filter(
    (t) => t.date >= startDate && t.date <= endDate
  );
  
  const income = filtered
    .filter((t) => t.type === "ENTRADA")
    .reduce((sum, t) => sum + t.amountCents, 0);
  
  const expense = filtered
    .filter((t) => t.type === "SAIDA")
    .reduce((sum, t) => sum + t.amountCents, 0);
  
  const balance = income - expense;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;
  
  return { incomeCents: income, expenseCents: expense, balanceCents: balance, savingsRate };
}
```

### Componentes Principais

#### 1. AccountFilter

**Arquivo**: `src/components/ledger/account-filter.tsx`  
**Props**:
```typescript
interface AccountFilterProps {
  accounts: AccountBalance[];
}
```

**O que faz**: Dropdown para filtrar por conta. Atualiza URL sem reload.

**Como usar**:
```tsx
<AccountFilter accounts={accounts} />
```

**Como alterar**:
- Para mudar o rótulo de "Todos os bancos", edite linha 37
- Para mudar estilos do dropdown, edite classes Tailwind

#### 2. MonthlySummary

**Arquivo**: `src/components/ledger/monthly-summary.tsx`  
**Props**:
```typescript
interface MonthlySummaryProps {
  totals: PeriodTotals;
  transactions: Array<{ type: "ENTRADA" | "SAIDA"; amountCents: number }>;
  openingCents: number;
  closingCents: number;
  previousMonthBalance?: number;
}
```

**O que faz**: Exibe resumo com 9 métricas do mês.

#### 3. TransactionFormDialog

**Arquivo**: `src/components/ledger/transaction-form-dialog.tsx`

**Como criar uma transação via UI**:
1. Clica "+ Nova Transação"
2. Preenche formulário
3. Clica "Criar"

**Como criar via código**:
```typescript
const result = await createTransactionAction({
  description: "Teste",
  amountCents: 15000,
  type: "SAIDA",
  accountId: "acc_123",
  date: new Date(),
});
```

---

## 🎨 Componentes Principais

### Componentes Base (UI)

Todos em `src/components/ui/` — importados de shadcn/ui

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```

### Componentes de Domínio

#### Layout

```
Header (nav, logout button)
  ├── NotificationBell
  ├── ThemeToggle
  └── User menu

Sidebar
  ├── Logo
  ├── NavItems (Dashboard, Ponto, Financeiro, etc)
  └── Settings
```

#### Dashboard

- `StatCard`: Card com número grande + título
- `DailyBalanceChart`: Gráfico de saldo diário (Recharts)
- `BalanceTrendChart`: Tendência ao longo do tempo

#### Time Entry

- `QuickPunch`: Entrada rápida (grande botão)
- `TimeEntryFormDialog`: Formulário completo
- `EntryRowActions`: Menu de ações (editar, deletar)

#### Ledger (Financeiro)

- `AccountFilter`: Dropdown de contas
- `MonthlySummary`: Resumo com métricas
- `CashflowChart`: Fluxo de caixa visual
- `CategoryBreakdown`: Gasto por categoria
- `TransactionFormDialog`: Formulário de transação

### Como Criar um Novo Componente

**Passo 1**: Criar arquivo

```typescript
// src/components/meu-dominio/meu-componente.tsx
"use client"; // Se precisa interatividade

import { ReactNode } from "react";

interface MeuComponenteProps {
  title: string;
  children: ReactNode;
}

/**
 * Descrição breve do que o componente faz
 * 
 * @example
 * <MeuComponente title="Teste">
 *   Conteúdo aqui
 * </MeuComponente>
 */
export function MeuComponente({ title, children }: MeuComponenteProps) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </div>
  );
}
```

**Passo 2**: Importar e usar

```typescript
import { MeuComponente } from "@/components/meu-dominio/meu-componente";

export function Page() {
  return (
    <MeuComponente title="Teste">
      Conteúdo
    </MeuComponente>
  );
}
```

---

## ⚙️ Como Alterar Manualmente

### 1. Alterar Cores do Tema

**Arquivo**: `tailwind.config.ts`

```typescript
export default {
  theme: {
    extend: {
      colors: {
        primary: "#2a78d6", // Cor primária (azul)
        accent: "#ff6b6b", // Cor destaque (vermelho)
      },
    },
  },
};
```

**Onde usar no CSS**:
```html
<button className="bg-primary text-white">Entrar</button>
<div className="border-accent">Atenção</div>
```

### 2. Alterar Rotas do Menu

**Arquivo**: `src/components/layout/nav-items.ts`

```typescript
export const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Meu Novo Link", href: "/minha-nova-rota", icon: "Star" },
  // ...
];
```

**Ícones disponíveis**: `lucide-react`

```typescript
import { LayoutDashboard, Star, Users, Settings } from "lucide-react";
```

### 3. Alterar Validações

**Arquivo**: `src/lib/validations.ts`

```typescript
// Validação de email
export const emailSchema = z.string().email("Email inválido");

// Validação customizada
export const dateSchema = z.string().refine(
  (val) => new Date(val) > new Date(),
  "Data deve ser no futuro"
);
```

### 4. Alterar Tipos de Transação

**Arquivo**: `prisma/schema.prisma`

```prisma
enum TransactionType {
  ENTRADA
  SAIDA
  TRANSFERENCIA // NOVO
  INVESTIMENTO // NOVO
}
```

**Depois executar**:
```bash
npm run db:migrate
```

### 5. Alterar Campos de Usuário

**Arquivo**: `prisma/schema.prisma`

```prisma
model User {
  // ... campos existentes
  
  phone String? // NOVO
  documentNumber String? // NOVO
}
```

**Depois executar**:
```bash
npm run db:migrate
```

### 6. Alterar Fórmulas de Cálculo

**Arquivo**: `src/lib/ledger-calc.ts` ou `src/lib/time-calc.ts`

```typescript
// Antes
const savingsRate = (balance / income) * 100;

// Depois (arredonda para 2 casas)
const savingsRate = Math.round((balance / income) * 100 * 100) / 100;
```

### 7. Alterar Mensagens de Erro

**Arquivo**: `src/lib/validations.ts`

```typescript
const schema = z.string().min(8, "Mínimo 8 caracteres NOVO");
```

### 8. Alterar Permissões de Acesso

**Arquivo**: `src/lib/auth.ts`

```typescript
export async function getCurrentUser() {
  const token = cookies().get("token")?.value;
  if (!token) return null;
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET!);
  
  // NOVO: Verificar se é ADMIN
  if (decoded.role !== "ADMIN") {
    throw new Error("Apenas ADMINs podem fazer isso");
  }
  
  return decoded;
}
```

---

## 🧪 Testes Locais

### Setup Inicial

```bash
# 1. Clonar repositório
git clone https://github.com/Casotti10/Ponto-.git
cd ponto

# 2. Instalar dependências
npm install

# 3. Criar arquivo .env com variáveis
cp .env.example .env

# 4. Configurar variáveis de ambiente
# Editar .env e preencher:
# - DATABASE_URL=postgresql://...
# - JWT_SECRET=seu_secret_aqui
# - NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Banco de Dados Local

```bash
# 1. Executar migrations
npm run db:migrate

# 2. Populate com dados de teste (opcional)
npm run db:seed

# 3. Abrir Prisma Studio (UI visual do banco)
npm run db:studio
# Acessa http://localhost:5555
```

### Executar em Desenvolvimento

```bash
# Terminal 1: Iniciar servidor
npm run dev
# Acessa http://localhost:3000

# Terminal 2 (opcional): Monitorar build
npm run build -- --watch
```

### Testar Diferentes Cenários

#### 1. Testar Autenticação

```bash
# 1. Acesse http://localhost:3000/login
# 2. Tente login com:
#    - Email: colaborador@empresa.com
#    - Senha: senha123
# 3. Deve redirecionar para /dashboard
# 4. Verifique cookie "token" no DevTools
```

#### 2. Testar Registro de Ponto

```bash
# 1. Login
# 2. Acesse /ponto
# 3. Clique "Registrar Entrada"
# 4. Verifique no banco se foi criado:
npm run db:studio
# Procure por time_entries
```

#### 3. Testar Transação Financeira

```bash
# 1. Login
# 2. Acesse /financeiro
# 3. Clique "+ Nova Transação"
# 4. Preencha:
#    - Descrição: "Teste"
#    - Valor: "R$ 100,00"
#    - Tipo: Saída
#    - Conta: Primeira conta disponível
# 5. Clique "Criar"
# 6. Verifique tabela de transações
```

#### 4. Testar Validações

```bash
# Senha fraca
# 1. /cadastro
# 2. Tente: "abc"
# 3. Deve exibir erro: "Mínimo 8 caracteres"

# Email duplicado
# 1. Login como colaborador@empresa.com
# 2. Logout
# 3. /cadastro
# 4. Tente: colaborador@empresa.com
# 5. Deve exibir erro: "Email já cadastrado"
```

#### 5. Testar Dark Mode

```bash
# 1. Clique ícone de lua/sol no header
# 2. Todos os componentes devem mudar de cor
# 3. Verifique localStorage: localStorage.getItem("theme")
```

#### 6. Testar Responsividade

```bash
# 1. Abra DevTools (F12)
# 2. Clique ícone de device (mobile)
# 3. Teste em:
#    - iPhone 12 (390x844)
#    - iPad (768x1024)
#    - Desktop (1920x1080)
# 4. Todos os componentes devem se adaptar
```

### Testes com Banco de Dados

```bash
# Ver todas as tables
npm run db:studio

# Fazer query SQL
npx prisma db execute --stdin
> SELECT * FROM users;

# Limpar banco (CUIDADO!)
npm run db:migrate reset
```

### Console/Debugging

```bash
# Ver logs do servidor
npm run dev
# Procure por console.log() no terminal

# Ver network requests
# DevTools → Network tab
# Procure por requisições para Server Actions

# Ver estado do aplicativo
# DevTools → React DevTools extension
# Procure por hooks state
```

---

## 🚀 Deploy

### Ambiente: Vercel

A aplicação está configurada para deploy automático na Vercel.

### Setup Automático

```bash
# 1. Já configurado no repositório
#    - vercel.json
#    - .env.production

# 2. Conectar repositório na Vercel
#    https://vercel.com/new

# 3. Vercel detecta Next.js
# 4. Configura variáveis de ambiente
# 5. Deploy automático a cada push em main
```

### Deploy Manual

```bash
# 1. Fazer commit
git add -A
git commit -m "feat: nova feature"

# 2. Push para main
git push origin main

# 3. Vercel detecta automaticamente
# 4. Deploy inicia (~2-3 minutos)
# 5. Você recebe notificação
```

### Build Local

```bash
# Gerar build de produção localmente
npm run build

# Testar build
npm start
# Acessa http://localhost:3000
```

### Variáveis de Ambiente Produção

Configuradas na Vercel:

```
DATABASE_URL=postgresql://... (Neon)
JWT_SECRET=seu_secret_super_seguro_aqui
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
NODE_ENV=production
```

### Monitorar Deploy

1. Acesse https://vercel.com/dashboard
2. Clique no seu projeto
3. Veja status em "Deployments"
4. Clique em deployment para ver logs

### Rollback (Reverter Deploy)

```bash
# Reverter último commit
git revert HEAD

# Push
git push origin main

# Vercel fará novo deploy automaticamente
```

---

## 🔌 Integrações Futuras

### 1. Google Calendar Integration

**Objetivo**: Sincronizar ausências e folgas com Google Calendar

**Implementação**:

```
1. Adicionar OAuth do Google
   - Obter Google Client ID e Secret
   - Configurar em .env
   
2. Criar novo model:
   model GoogleCalendarIntegration {
     userId String @unique
     googleId String
     accessToken String (criptografado)
     refreshToken String (criptografado)
   }

3. Sincronizar ausências:
   - Quando criar Absence → criar evento no Google Calendar
   - Quando deletar Absence → deletar evento
   
4. Sincronizar calendário:
   - Ler eventos do Google Calendar
   - Criar Absence automaticamente

5. Arquivo para implementar:
   src/lib/integrations/google-calendar.ts
```

### 2. WhatsApp / Telegram Notifications

**Objetivo**: Notificar usuário de eventos via WhatsApp

**Implementação**:

```
1. Escolher provedor:
   - Twilio (WhatsApp)
   - Telegram Bot API
   
2. Adicionar chaves em .env
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   
3. Criar funções de envio:
   await sendWhatsAppNotification(phone, message);
   
4. Disparar em eventos:
   - Novo ponto registrado
   - Aprovação de férias
   - Alerta de banco de horas negativo
   
5. Arquivo para implementar:
   src/lib/integrations/notifications.ts
```

### 3. Stripe / Mercado Pago (Pagamentos)

**Objetivo**: Monetizar plataforma com plano pago

**Implementação**:

```
1. Escolher provedor:
   - Stripe (Internacional)
   - Mercado Pago (Brasil)
   
2. Adicionar chaves
   STRIPE_SECRET_KEY=...
   STRIPE_PUBLISHABLE_KEY=...
   
3. Criar checkout:
   src/components/payment/checkout-form.tsx
   
4. Gerenciar subscrições:
   model Subscription {
     userId String @unique
     plan Plan // FREE, PRO, ENTERPRISE
     status String // active, canceled, expired
     expiresAt DateTime
   }
   
5. Limitar features por plan:
   if (user.subscription.plan === "FREE") {
     maxUsers = 1;
     maxMonths = 3;
   }
```

### 4. Integrações Bancárias (Open Banking)

**Objetivo**: Importar transações automaticamente do banco

**Implementação**:

```
1. Usar serviço como Plaid ou Fiserv
   
2. Conectar conta bancária
   
3. Webhook recebe novas transações
   
4. Criar Transaction automaticamente:
   {
     description: "Supermercado",
     amountCents: 15000,
     type: "SAIDA",
     accountId: user.accounts[0],
     date: "2024-08-01",
     source: "IMPORTACAO", // Diferencia de manual
   }
   
5. Reconciliação:
   - Flagrar transações duplicadas
   - Permitir edição depois de importar
```

### 5. n8n / Zapier (Automações)

**Objetivo**: Integrar com serviços externos via webhooks

**Implementação**:

```
1. Criar webhook endpoint:
   POST /api/webhooks/n8n
   
2. Receber dados:
   { action: "create_transaction", data: {...} }
   
3. Processar no sistema
   
4. Automatizar fluxos:
   - Quando transação > R$ 1000, notificar via Slack
   - Quando fechar mês, enviar relatório por email
   - Quando criar férias, atualizar Asana

5. Arquivo para implementar:
   src/app/api/webhooks/n8n/route.ts
```

### 6. IA / Claude API (Análise de Gastos)

**Objetivo**: Usar IA para analisar gastos e dar recomendações

**Implementação**:

```typescript
import Anthropic from "@anthropic-sdk/sdk";

const client = new Anthropic();

export async function analyzeSpending(transactions: Transaction[]) {
  const message = await client.messages.create({
    model: "claude-opus-4",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analise estes gastos e dê 3 recomendações:
        ${JSON.stringify(transactions)}`,
      },
    ],
  });
  
  return message.content;
}
```

**Como usar no UI**:
```tsx
// Novo componente: src/components/ledger/ai-insights.tsx
export function AIInsights({ transactions }) {
  const [insights, setInsights] = useState(null);
  
  async function analyze() {
    const result = await analyzeSpending(transactions);
    setInsights(result);
  }
  
  return (
    <Card>
      <CardTitle>Análise com IA</CardTitle>
      <Button onClick={analyze}>Analisar Gastos</Button>
      {insights && <p>{insights}</p>}
    </Card>
  );
}
```

---

## 🆘 Troubleshooting

### Problema: "JWT Token Inválido"

**Solução**:
```bash
# 1. Verificar .env
echo $JWT_SECRET

# 2. Se vazio, gerar novo:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Colocar em .env:
JWT_SECRET=seu_novo_secret

# 4. Limpar cookies:
# DevTools → Application → Cookies → Delete all
```

### Problema: "Erro ao conectar ao banco"

**Solução**:
```bash
# 1. Verificar DATABASE_URL
echo $DATABASE_URL

# 2. Testar conexão
npx prisma db execute --stdin
> SELECT 1;

# 3. Se não funcionar, recria conexão no Neon:
# https://console.neon.tech

# 4. Atualiza .env com nova URL
```

### Problema: "Página em branco após login"

**Solução**:
```bash
# 1. Abrir DevTools (F12)
# 2. Console → procurar por erros
# 3. Se vir erro de import, verificar:
#    - Caminhos dos imports (usar @/...)
#    - Typos em nomes de arquivos
#    - Componentes não exportados

# 4. Se for erro de build:
npm run build
# Corrigir erros mostrados
```

### Problema: "Styles não aparecem (Tailwind)"

**Solução**:
```bash
# 1. Verificar tailwind.config.ts:
export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
};

# 2. Reiniciar servidor:
npm run dev
# Ctrl+C → npm run dev novamente

# 3. Se ainda não funcionar:
npm run build
# Pode conter erros de CSS
```

### Problema: "Transação não aparece na tabela"

**Solução**:
```bash
# 1. Verificar no banco:
npm run db:studio
# Procurar em transactions

# 2. Checar filtros:
# Está filtrado por conta errada?
# Está filtrado por mês errado?

# 3. Fazer revalidation manual:
npm run dev
# Ativar em DevTools → Application → Clear Storage → Reload
```

### Problema: "Erro 403 ao fazer deploy"

**Solução**:
```bash
# 1. Verificar variáveis de ambiente em production:
# Vercel Dashboard → Settings → Environment Variables

# 2. Certificar que JWT_SECRET está setado

# 3. Verificar se banco de dados está acessível:
# Neon Console → Connection String

# 4. Fazer rebuild:
# Vercel Dashboard → Redeploy
```

---

## 📊 Resumo de Arquivos Importantes

| Arquivo | Responsabilidade | Quando Alterar |
|---------|------------------|-----------------|
| `prisma/schema.prisma` | Estrutura do banco | Adicionar/remover campos ou tabelas |
| `src/lib/validations.ts` | Validações (Zod) | Mudar regras de validação |
| `src/lib/auth.ts` | Autenticação | Alterar lógica de login/logout |
| `src/components/layout/nav-items.ts` | Menu lateral | Adicionar/remover rotas no menu |
| `tailwind.config.ts` | Cores e tema | Alterar cores da aplicação |
| `src/lib/actions/*.ts` | Operações do servidor | Alterar lógica de negócio |
| `.env` | Variáveis de ambiente | Configurar credenciais |
| `vercel.json` | Configuração de deploy | Alterar processo de build/deploy |

---

## ✅ Checklist de Desenvolvimento

### Antes de Fazer Alterações

- [ ] Criar branch: `git checkout -b feat/minha-feature`
- [ ] Ter `.env` configurado
- [ ] `npm install` e dependências atualizadas
- [ ] Banco de dados (migrations) atualizado

### Durante Desenvolvimento

- [ ] Codar conforme padrões (TS, componentes funcionais)
- [ ] Adicionar comentários JSDoc em funções importantes
- [ ] Testar localmente: `npm run dev`
- [ ] Testar build: `npm run build`
- [ ] Não commitar `.env` (usar `.env.example`)

### Antes de Fazer Push

- [ ] Testes locais passando
- [ ] Sem erros TypeScript: `npm run build`
- [ ] Sem warnings ESLint
- [ ] Mensagem de commit descritiva
- [ ] Relacionar com issue se houver

### Antes de Deploy

- [ ] Review do código
- [ ] Testes em staging (se houver)
- [ ] Verificar variáveis de ambiente de produção
- [ ] Ter plano de rollback

---

## 🎓 Conclusão

Esta documentação cobre a estrutura completa do Ponto+. Para mais detalhes:

1. **Código**: Verifique comentários JSDoc nos arquivos
2. **Schema**: `prisma/schema.prisma` documenta banco
3. **Tipos**: TypeScript fornece type hints automáticos
4. **Componentes**: Cada arquivo tem interface clara

**Desenvolvedor**: Lucas Casotti  
**Última atualização**: 04/08/2026  
**Versão**: 0.1.0

---

**Dúvidas?** Consulte os arquivos específicos ou execute:
```bash
npm run build  # Validar erros
npm run dev    # Testar
git log        # Ver histórico
```

