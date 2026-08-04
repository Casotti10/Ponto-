#!/usr/bin/env node

/**
 * Script para gerar PDF da documentação técnica
 *
 * Uso: node scripts/gerar-pdf.js
 */

const fs = require('fs');
const path = require('path');

// Criar arquivo PDF em HTML que pode ser impresso
const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentação Técnica - Ponto+ v0.1.0</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: A4;
            margin: 2cm;
        }

        @media print {
            body {
                background: white;
                color: black;
            }

            section {
                page-break-inside: avoid;
                break-inside: avoid;
            }

            h2 {
                page-break-after: avoid;
            }

            table {
                page-break-inside: avoid;
            }

            .toc {
                page-break-after: always;
            }

            a {
                color: #0066cc;
            }
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
        }

        /* ===== CAPA ===== */
        .capa {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            text-align: center;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            page-break-after: always;
        }

        .capa h1 {
            font-size: 3.5em;
            margin-bottom: 20px;
            font-weight: 700;
        }

        .capa h2 {
            font-size: 1.8em;
            font-weight: 400;
            margin-bottom: 40px;
            border: none;
        }

        .capa-metadata {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 80px;
            font-size: 1.1em;
        }

        .capa-metadata div {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .capa-metadata span:first-child {
            font-weight: 600;
            margin-bottom: 5px;
        }

        /* ===== ÍNDICE ===== */
        .toc {
            page-break-after: always;
        }

        .toc h2 {
            text-align: center;
            margin-bottom: 40px;
        }

        .toc ol {
            columns: 2;
            column-gap: 40px;
            list-style-position: inside;
        }

        .toc li {
            margin-bottom: 15px;
            line-height: 1.8;
            break-inside: avoid;
        }

        /* ===== GERAL ===== */
        h2 {
            color: #4f46e5;
            font-size: 2em;
            margin: 40px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 3px solid #4f46e5;
            page-break-after: avoid;
        }

        h3 {
            color: #7c3aed;
            font-size: 1.4em;
            margin: 25px 0 15px 0;
            page-break-after: avoid;
        }

        h4 {
            color: #a78bfa;
            font-size: 1.1em;
            margin: 15px 0 10px 0;
        }

        p {
            margin-bottom: 15px;
            text-align: justify;
        }

        section {
            margin-bottom: 30px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 0.95em;
        }

        th {
            background: #4f46e5;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }

        td {
            padding: 10px 12px;
            border-bottom: 1px solid #ddd;
        }

        tr:nth-child(even) {
            background: #f9f9f9;
        }

        code {
            background: #f5f5f5;
            border-radius: 3px;
            padding: 2px 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }

        pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            margin-bottom: 15px;
            font-size: 0.85em;
            line-height: 1.4;
            page-break-inside: avoid;
        }

        ul, ol {
            margin-left: 25px;
            margin-bottom: 15px;
        }

        li {
            margin-bottom: 8px;
        }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
            margin-right: 10px;
        }

        .badge-status {
            background: #dcfce7;
            color: #166534;
        }

        .badge-version {
            background: #dbeafe;
            color: #1e40af;
        }

        .highlight {
            background: #fff3cd;
            padding: 12px 15px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
            margin-bottom: 15px;
            page-break-inside: avoid;
        }

        .flow-diagram {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 0.85em;
            margin-bottom: 15px;
            page-break-inside: avoid;
            overflow: hidden;
            white-space: pre-wrap;
        }

        .structure-tree {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 0.8em;
            margin-bottom: 15px;
            page-break-inside: avoid;
        }

        .footer {
            text-align: center;
            padding: 40px 0;
            border-top: 1px solid #ddd;
            margin-top: 50px;
            page-break-before: always;
            font-size: 0.95em;
            color: #666;
        }

        .footer p {
            margin-bottom: 10px;
        }

        .page-number {
            text-align: center;
            margin-top: 20px;
            color: #999;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <!-- CAPA -->
    <div class="capa">
        <h1>📘 Documentação Técnica</h1>
        <h2>Ponto+ — Controle de Ponto & Gestão Financeira</h2>
        <div class="capa-metadata">
            <div>
                <span>Versão</span>
                <strong>0.1.0</strong>
            </div>
            <div>
                <span>Data</span>
                <strong>04/08/2026</strong>
            </div>
            <div>
                <span>Desenvolvedor</span>
                <strong>Lucas Casotti</strong>
            </div>
            <div>
                <span>Status</span>
                <strong>✅ Em Produção</strong>
            </div>
        </div>
    </div>

    <!-- ÍNDICE -->
    <div class="toc">
        <h2>📋 Sumário</h2>
        <ol>
            <li>Visão Geral</li>
            <li>Tecnologias Utilizadas</li>
            <li>Estrutura do Projeto</li>
            <li>Arquitetura do Sistema</li>
            <li>Banco de Dados</li>
            <li>Rotas da Aplicação</li>
            <li>Autenticação e Segurança</li>
            <li>Módulo de Ponto</li>
            <li>Módulo Financeiro</li>
            <li>Componentes Principais</li>
            <li>Como Alterar Manualmente</li>
            <li>Testes Locais</li>
            <li>Deploy</li>
            <li>Integrações Futuras</li>
            <li>Troubleshooting</li>
        </ol>
    </div>

    <!-- CONTEÚDO -->
    <section>
        <h2>1. Visão Geral</h2>

        <h3>O que é Ponto+?</h3>
        <p>Ponto+ é uma aplicação web moderna para controle de ponto e gestão financeira pessoal/empresarial. Permite que funcionários registrem suas entradas e saídas, gerenciem banco de horas, acompanhem férias/ausências, e monitorem fluxo de caixa e despesas.</p>

        <h3>Funcionalidades Principais</h3>
        <ul>
            <li>✅ Registro entrada/saída em tempo real</li>
            <li>✅ Banco de horas automático</li>
            <li>✅ Gestão de faltas, férias, licenças</li>
            <li>✅ Dashboard financeiro com múltiplas contas</li>
            <li>✅ Fluxo de caixa mensal com gráficos</li>
            <li>✅ Exportação em PDF e Excel</li>
            <li>✅ Dark mode nativo</li>
            <li>✅ PWA (funciona offline)</li>
        </ul>
    </section>

    <section>
        <h2>2. Tecnologias Utilizadas</h2>

        <h3>Stack Principal</h3>
        <table>
            <tr>
                <th>Camada</th>
                <th>Tecnologia</th>
                <th>Versão</th>
                <th>Uso</th>
            </tr>
            <tr>
                <td rowspan="4">Frontend</td>
                <td>React</td>
                <td>19.2.4</td>
                <td>UI com hooks modernos</td>
            </tr>
            <tr>
                <td>Next.js</td>
                <td>16.2.11</td>
                <td>SSR, Server Components</td>
            </tr>
            <tr>
                <td>TypeScript</td>
                <td>5.x</td>
                <td>Type-safety</td>
            </tr>
            <tr>
                <td>Tailwind CSS</td>
                <td>4.x</td>
                <td>Styling + dark mode</td>
            </tr>
            <tr>
                <td rowspan="3">Backend</td>
                <td>Prisma ORM</td>
                <td>6.19.3</td>
                <td>Acesso ao BD</td>
            </tr>
            <tr>
                <td>bcryptjs</td>
                <td>3.0.3</td>
                <td>Hash de senhas</td>
            </tr>
            <tr>
                <td>JWT</td>
                <td>9.0.3</td>
                <td>Autenticação</td>
            </tr>
            <tr>
                <td>Database</td>
                <td>PostgreSQL</td>
                <td>Neon</td>
                <td>Banco serverless</td>
            </tr>
        </table>
    </section>

    <section>
        <h2>3. Estrutura do Projeto</h2>

        <h3>Organização de Pastas</h3>
        <pre>ponto/
├── src/app/                  # Rotas (Next.js)
├── src/components/           # Componentes React
│   ├── ui/                  # Base (shadcn/ui)
│   ├── layout/
│   ├── timeentry/
│   └── ledger/
├── src/lib/                  # Lógica de negócio
│   ├── actions/             # Server Actions
│   ├── *-calc.ts            # Cálculos
│   └── validations.ts
├── prisma/
│   ├── schema.prisma        # BD schema
│   └── migrations/
└── DOCUMENTACAO_TECNICA.md</pre>

        <h3>Responsabilidades</h3>
        <ul>
            <li><strong>src/app/</strong>: Rotas e páginas (App Router do Next.js)</li>
            <li><strong>src/components/ui/</strong>: Componentes base sem lógica</li>
            <li><strong>src/components/{domain}/</strong>: Componentes específicos do domínio</li>
            <li><strong>src/lib/actions/</strong>: Server Actions (lógica no servidor)</li>
            <li><strong>src/lib/*-calc.ts</strong>: Cálculos puros</li>
            <li><strong>prisma/</strong>: Schema e migrations do banco</li>
        </ul>
    </section>

    <section>
        <h2>4. Arquitetura do Sistema</h2>

        <h3>Fluxo de Dados</h3>
        <div class="flow-diagram">Navegador (React)
    ↓ HTTP/JSON
Next.js Server (Node.js)
    ├── Server Actions
    ├── Prisma ORM
    └── Validação (Zod)
    ↓ TCP/IP
PostgreSQL (Neon)</div>

        <h3>Padrões Utilizados</h3>
        <ul>
            <li><strong>Server Components:</strong> Renderização no servidor, sem JS no cliente</li>
            <li><strong>Client Components:</strong> Interatividade no navegador (com "use client")</li>
            <li><strong>Server Actions:</strong> Funções executadas no servidor, chamadas do cliente</li>
            <li><strong>Validação em Camadas:</strong> Cliente (Zod) → Servidor (Zod) → BD (Prisma)</li>
        </ul>
    </section>

    <section>
        <h2>5. Banco de Dados</h2>

        <h3>Tabelas Principais</h3>
        <table>
            <tr>
                <th>Tabela</th>
                <th>Função</th>
                <th>Campos Principais</th>
            </tr>
            <tr>
                <td>users</td>
                <td>Usuários do sistema</td>
                <td>id, email, password, role, name</td>
            </tr>
            <tr>
                <td>time_entries</td>
                <td>Registros de ponto</td>
                <td>id, userId, type, time, date</td>
            </tr>
            <tr>
                <td>absences</td>
                <td>Faltas, férias, licenças</td>
                <td>id, userId, type, dateStart, dateEnd, impact</td>
            </tr>
            <tr>
                <td>transactions</td>
                <td>Transações financeiras</td>
                <td>id, userId, accountId, type, amountCents, date</td>
            </tr>
            <tr>
                <td>accounts</td>
                <td>Contas bancárias</td>
                <td>id, userId, name, type, color, balance</td>
            </tr>
            <tr>
                <td>audit_logs</td>
                <td>Histórico de ações</td>
                <td>id, userId, action, entity, entityId, changes</td>
            </tr>
        </table>

        <div class="highlight">
            <strong>💡 Importante:</strong> Valores financeiros são armazenados em <strong>centavos (Int)</strong> para evitar problemas de arredondamento.
        </div>
    </section>

    <section>
        <h2>6. Rotas da Aplicação</h2>

        <h3>Rotas Públicas</h3>
        <table>
            <tr>
                <th>Rota</th>
                <th>Descrição</th>
            </tr>
            <tr>
                <td>/</td>
                <td>Página inicial (redireciona para login ou dashboard)</td>
            </tr>
            <tr>
                <td>/login</td>
                <td>Formulário de login</td>
            </tr>
            <tr>
                <td>/cadastro</td>
                <td>Formulário de cadastro</td>
            </tr>
        </table>

        <h3>Rotas Protegidas (requer autenticação)</h3>
        <table>
            <tr>
                <th>Rota</th>
                <th>Descrição</th>
            </tr>
            <tr>
                <td>/dashboard</td>
                <td>Dashboard principal com KPIs</td>
            </tr>
            <tr>
                <td>/ponto</td>
                <td>Registro e histórico de ponto</td>
            </tr>
            <tr>
                <td>/ausencias</td>
                <td>Gestão de faltas, férias</td>
            </tr>
            <tr>
                <td>/financeiro</td>
                <td>Dashboard financeiro</td>
            </tr>
            <tr>
                <td>/relatorios</td>
                <td>Exportação de dados</td>
            </tr>
            <tr>
                <td>/configuracoes</td>
                <td>Perfil e preferências</td>
            </tr>
        </table>
    </section>

    <section>
        <h2>7. Autenticação e Segurança</h2>

        <h3>Fluxo de Login</h3>
        <ol>
            <li>Usuário entra email + senha em /login</li>
            <li>loginAction() valida credenciais</li>
            <li>Senha verificada com bcrypt</li>
            <li>JWT token criado e armazenado em cookie</li>
            <li>Redireciona para /dashboard</li>
            <li>A cada request, JWT é validado automaticamente</li>
            <li>Se expirou (7 dias) → usuário redirecionado para /login</li>
        </ol>

        <h3>Validação de Senha (NIST SP 800-63B)</h3>
        <ul>
            <li>✅ Mínimo 8 caracteres</li>
            <li>✅ Máximo 72 caracteres (limite do bcrypt)</li>
            <li>✅ Deve conter: minúsculas, MAIÚSCULAS, números, símbolos</li>
            <li>✅ Não pode conter email do usuário</li>
        </ul>

        <h3>Proteção de Dados</h3>
        <table>
            <tr>
                <th>Dado</th>
                <th>Proteção</th>
            </tr>
            <tr>
                <td>Senhas</td>
                <td>bcrypt (hashing)</td>
            </tr>
            <tr>
                <td>Tokens JWT</td>
                <td>Assinado, expira em 7 dias</td>
            </tr>
            <tr>
                <td>Variáveis de ambiente</td>
                <td>.env (nunca commitar)</td>
            </tr>
            <tr>
                <td>Auditoria</td>
                <td>Todas ações registradas em audit_logs</td>
            </tr>
        </table>
    </section>

    <section>
        <h2>8. Módulo de Ponto</h2>

        <h3>Tipos de Entrada</h3>
        <table>
            <tr>
                <th>Tipo</th>
                <th>Significado</th>
                <th>Código</th>
            </tr>
            <tr>
                <td>Entrada</td>
                <td>Chegada do dia</td>
                <td>ENTRADA</td>
            </tr>
            <tr>
                <td>Saída Almoço</td>
                <td>Saída para almoço</td>
                <td>SAIDA_ALMOCO</td>
            </tr>
            <tr>
                <td>Retorno Almoço</td>
                <td>Volta do almoço</td>
                <td>RETORNO_ALMOCO</td>
            </tr>
            <tr>
                <td>Saída</td>
                <td>Saída do dia</td>
                <td>SAIDA</td>
            </tr>
        </table>

        <h3>Cálculo de Jornada</h3>
        <ol>
            <li>Ordena entries por hora do dia</li>
            <li>Calcula períodos (entrada → saída almoço, retorno → saída)</li>
            <li>Subtrai intervalo de almoço</li>
            <li>Compara com jornada esperada (work schedule)</li>
            <li>Retorna diferença (horas positivas/negativas)</li>
        </ol>
    </section>

    <section>
        <h2>9. Módulo Financeiro</h2>

        <h3>Estrutura de Dados</h3>
        <pre>Account (Conta Bancária)
  ├── name: "Nubank"
  ├── type: "CORRENTE"
  ├── color: "#2a78d6"
  └── balance: 500000 (em centavos = R$ 5.000)

Transaction (Transação)
  ├── description: "Supermercado"
  ├── type: "SAIDA"
  ├── amountCents: 15000 (R$ 150)
  ├── date: "2024-08-01"
  └── accountId: "acc_123"</pre>

        <h3>Fluxo de Adição de Transação</h3>
        <ol>
            <li>Clica "+ Nova Transação"</li>
            <li>Dialog abre com formulário</li>
            <li>Preenche: descrição, valor, tipo, conta, categoria, data</li>
            <li>Validação Zod no cliente</li>
            <li>createTransactionAction() chamada</li>
            <li>Validação Zod no servidor</li>
            <li>Transação criada no BD</li>
            <li>Saldo da conta atualizado</li>
            <li>Cache revalidado</li>
            <li>Toast de sucesso</li>
        </ol>

        <h3>Cálculos Principais</h3>
        <pre>Income (Receitas):
  Σ(amountCents onde type = "ENTRADA")

Expense (Despesas):
  Σ(amountCents onde type = "SAIDA")

Balance (Saldo):
  income - expense

Savings Rate (Poupança %):
  (balance / income) * 100</pre>
    </section>

    <section>
        <h2>10. Como Alterar Manualmente</h2>

        <h3>1. Alterar Cores do Tema</h3>
        <p><strong>Arquivo:</strong> tailwind.config.ts</p>
        <pre>theme: {
  colors: {
    primary: "#2a78d6",   // Azul
    accent: "#ff6b6b",    // Vermelho
  }
}</pre>

        <h3>2. Adicionar Rota no Menu</h3>
        <p><strong>Arquivo:</strong> src/components/layout/nav-items.ts</p>
        <pre>{ label: "Nova Página", href: "/nova", icon: "Star" }</pre>

        <h3>3. Alterar Validações</h3>
        <p><strong>Arquivo:</strong> src/lib/validations.ts</p>
        <pre>z.string().min(8, "Mínimo 8 caracteres")</pre>

        <h3>4. Adicionar Campo no Banco</h3>
        <p><strong>Arquivo:</strong> prisma/schema.prisma</p>
        <pre>model User {
  phone String?          // NOVO
  documentNumber String? // NOVO
}

// Depois: npm run db:migrate</pre>

        <h3>5. Alterar Fórmulas de Cálculo</h3>
        <p><strong>Arquivo:</strong> src/lib/ledger-calc.ts</p>
        <pre>// Arredonda para 2 casas decimais
const savingsRate = Math.round((balance / income) * 100 * 100) / 100;</pre>

        <div class="highlight">
            <strong>⚠️ Lembre-se:</strong> Após alterar prisma/schema.prisma, sempre executar <code>npm run db:migrate</code>
        </div>
    </section>

    <section>
        <h2>11. Testes Locais</h2>

        <h3>Setup Inicial</h3>
        <pre># 1. Clonar repositório
git clone https://github.com/Casotti10/Ponto-.git
cd ponto

# 2. Instalar dependências
npm install

# 3. Criar .env com variáveis
cp .env.example .env

# 4. Executar migrations
npm run db:migrate

# 5. Seed com dados de teste
npm run db:seed</pre>

        <h3>Executar em Desenvolvimento</h3>
        <pre># Terminal 1: Iniciar servidor
npm run dev
# Acessa http://localhost:3000

# Terminal 2: Abrir Prisma Studio
npm run db:studio
# Acessa http://localhost:5555</pre>

        <h3>Testar Funcionalidades</h3>
        <ul>
            <li><strong>Login:</strong> colaborador@empresa.com / senha123</li>
            <li><strong>Ponto:</strong> /ponto → "Registrar Entrada"</li>
            <li><strong>Transação:</strong> /financeiro → "+ Nova Transação"</li>
            <li><strong>Dark Mode:</strong> Clique ícone lua/sol no header</li>
            <li><strong>Responsividade:</strong> DevTools → Device Toolbar</li>
        </ul>
    </section>

    <section>
        <h2>12. Deploy</h2>

        <h3>Plataforma: Vercel (Automático)</h3>
        <p>Cada push em <strong>main</strong> dispara deploy automático.</p>

        <h3>Deploy Manual</h3>
        <pre># 1. Commit suas mudanças
git add -A
git commit -m "feat: nova feature"

# 2. Push para main
git push origin main

# 3. Vercel detecta e faz deploy (~2-5 min)
# 4. URL: https://seu-projeto.vercel.app</pre>

        <h3>Variáveis de Produção (Vercel Dashboard)</h3>
        <table>
            <tr>
                <th>Variável</th>
                <th>Valor</th>
            </tr>
            <tr>
                <td>DATABASE_URL</td>
                <td>postgresql://... (Neon)</td>
            </tr>
            <tr>
                <td>JWT_SECRET</td>
                <td>Secret super seguro</td>
            </tr>
            <tr>
                <td>NEXT_PUBLIC_APP_URL</td>
                <td>https://seu-dominio.com</td>
            </tr>
            <tr>
                <td>NODE_ENV</td>
                <td>production</td>
            </tr>
        </table>

        <h3>Build Local</h3>
        <pre># Gerar build de produção
npm run build

# Testar build localmente
npm start
# Acessa http://localhost:3000</pre>
    </section>

    <section>
        <h2>13. Integrações Futuras</h2>

        <h3>Google Calendar</h3>
        <p>Sincronizar ausências com Google Calendar. OAuth + webhook para criar/atualizar eventos automaticamente.</p>

        <h3>WhatsApp / Telegram</h3>
        <p>Notificações de ponto registrado, férias aprovadas, saldo negativo. Usar Twilio ou Telegram Bot API.</p>

        <h3>Stripe / Mercado Pago</h3>
        <p>Monetização com planos: FREE (1 usuário, 3 meses), PRO, ENTERPRISE. Webhooks para gerenciar subscrições.</p>

        <h3>Open Banking</h3>
        <p>Importar transações do banco automaticamente via Plaid ou Fiserv. Reconciliação automática.</p>

        <h3>n8n / Zapier</h3>
        <p>Automações: transação > R$ 1000 → notificar Slack, fechar mês → enviar relatório por email.</p>

        <h3>IA (Claude API)</h3>
        <p>Analisar gastos e fornecer recomendações. Gerar insights personalizados sobre padrões de gasto.</p>
    </section>

    <section>
        <h2>14. Troubleshooting</h2>

        <h3>JWT Token Inválido</h3>
        <pre># Gerar novo JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Colocar em .env
JWT_SECRET=seu_novo_secret

# Limpar cookies: DevTools → Clear Storage</pre>

        <h3>Erro Conectar ao Banco</h3>
        <pre># Verificar DATABASE_URL
echo $DATABASE_URL

# Testar conexão
npx prisma db execute --stdin
> SELECT 1;</pre>

        <h3>Styles (Tailwind) Não Aparecem</h3>
        <pre># Reiniciar servidor
npm run dev
# Ctrl+C → npm run dev

# Se persistir, fazer rebuild
npm run build</pre>

        <h3>Página em Branco</h3>
        <ul>
            <li>DevTools → Console → verificar erros</li>
            <li>Verificar imports (usar @/... paths)</li>
            <li>Certificar que componentes estão exportados</li>
            <li>Executar: <code>npm run build</code></li>
        </ul>

        <h3>Erro 403 em Deploy</h3>
        <ul>
            <li>Verificar variáveis em Vercel Dashboard</li>
            <li>Certificar JWT_SECRET está setado</li>
            <li>Testar acesso ao banco</li>
            <li>Fazer redeploy: Vercel Dashboard → Redeploy</li>
        </ul>
    </section>

    <!-- FOOTER -->
    <div class="footer">
        <h2 style="border: none; margin-bottom: 20px;">✅ Conclusão</h2>
        <p>Esta documentação cobre a estrutura completa do Ponto+. Para detalhes adicionais, consulte:</p>
        <ul style="list-style: none; margin-left: 0;">
            <li>• Comentários JSDoc nos arquivos fonte</li>
            <li>• Arquivo DOCUMENTACAO_TECNICA.md (versão Markdown)</li>
            <li>• Código em src/lib/actions/ (lógica do servidor)</li>
            <li>• prisma/schema.prisma (estrutura do BD)</li>
        </ul>

        <p style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
            <strong>Desenvolvedor:</strong> Lucas Casotti<br>
            <strong>Versão:</strong> 0.1.0<br>
            <strong>Status:</strong> ✅ Em Produção<br>
            <strong>Última atualização:</strong> 04/08/2026
        </p>

        <p class="page-number">🖨️ Imprima este documento para ter sempre à mão. Use Ctrl+P ou Cmd+P para salvar como PDF.</p>
    </div>
</body>
</html>
`;

const outputPath = path.join(__dirname, '../docs/DOCUMENTACAO_TECNICA.html');

try {
    fs.writeFileSync(outputPath, htmlContent, 'utf-8');
    console.log('✅ PDF/HTML gerado com sucesso!');
    console.log(`📄 Arquivo: ${outputPath}`);
    console.log('\n📖 Para visualizar:');
    console.log('   1. Abra o arquivo no navegador');
    console.log('   2. Pressione Ctrl+P (ou Cmd+P no Mac)');
    console.log('   3. Clique "Salvar como PDF"');
    console.log('   4. Escolha local e pronto!');
} catch (error) {
    console.error('❌ Erro ao gerar PDF:', error);
    process.exit(1);
}
