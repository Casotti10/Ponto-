# Ponto+ — Controle de Ponto e Banco de Horas

Sistema completo de controle de ponto e banco de horas para uso interno da empresa: registro de ponto, cálculo automático de horas extras/negativas, ausências, banco de horas manual, calendário, relatórios exportáveis (PDF/Excel/CSV), pesquisa, histórico de auditoria e configurações de jornada.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Base UI)
- **Prisma ORM** + **PostgreSQL**
- **Recharts** para gráficos
- Autenticação própria via cookie httpOnly + JWT (sem serviço externo)
- `jspdf` / `xlsx` para exportação de relatórios
- PWA (manifest + service worker) com página offline

## Rodando localmente

1. Suba um Postgres local (ex: `docker run -d --name ponto-postgres -e POSTGRES_USER=ponto -e POSTGRES_PASSWORD=ponto -e POSTGRES_DB=ponto -p 5432:5432 postgres:16-alpine`).
2. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` / `JWT_SECRET`.
3. Instale as dependências e rode as migrations:
   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:3000` e entre com uma das contas de demonstração criadas pelo seed:
   - `admin@empresa.com` / `senha123`
   - `colaborador@empresa.com` / `senha123`

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `JWT_SECRET` | Segredo usado para assinar o cookie de sessão (gere um valor longo e aleatório em produção) |
| `NEXT_PUBLIC_APP_NAME` | Nome exibido na interface (opcional) |

## Regras de cálculo (resumo)

O motor de cálculo (`src/lib/time-calc.ts` e `src/lib/time-service.ts`) determina, por dia:

- **Horas trabalhadas**: soma dos intervalos entre `ENTRADA`→`SAÍDA_ALMOÇO` e `RETORNO_ALMOÇO`→`SAÍDA`.
- **Horas previstas**: `jornada diária` configurada, apenas em dias úteis definidos em Configurações.
- **Extra/Negativo**: diferença entre trabalhado e previsto.
- **Ausências**: cada tipo (falta justificada/injustificada, férias, licença, folga, home office, banco de horas, compensação) tem uma regra própria de impacto no saldo.
- **Saldo acumulado**: soma de todos os deltas diários + ajustes manuais registrados no Banco de Horas.
- **Fechamento mensal**: snapshot histórico do saldo ao final do mês, disponível em Banco de Horas.

## Nota sobre datas e timezone

Os campos de "dia" (`TimeEntry.date`, `Absence.date/endDate`) são armazenados como `DateTime` **sem** `@db.Date`. Isso é proposital: o tipo `DATE` do Postgres normaliza o valor pelo calendário UTC na escrita, mas o Prisma reconstrói o valor de leitura à meia-noite UTC — em qualquer timezone com offset negativo isso faz o dia "voltar" quando lido com getters locais (`getDate()`, `date-fns`, etc.). Mantendo como `DateTime` comum, o valor local se preserva corretamente no round-trip (mesmo comportamento already usado pelo campo `time`). Não reintroduza `@db.Date` nesses campos sem também migrar toda a leitura para getters UTC.

## Deploy

Ver seção de deploy fornecida separadamente pelo agente que gerou este projeto (URL de produção, comandos e variáveis necessárias na Vercel).
