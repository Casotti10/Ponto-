# 🗄️ Como Consultar o Banco de Dados - Ponto+

**Status**: ✅ Banco conectado e pronto para usar  
**Tipo**: PostgreSQL (Neon Serverless)  
**Interface**: Prisma Studio (Visual)  
**Data**: 04/08/2026

---

## 🚀 Início Rápido

### **ABRA AGORA NESTE LINK:**

```
http://localhost:5555
```

Se não abrir automaticamente, copie a URL acima no navegador.

---

## 📊 O Que Você Verá

Quando abrires em http://localhost:5555, verás essa interface:

```
┌─────────────────────────────────────────────────────────┐
│                  PRISMA STUDIO                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Tabelas do Banco:                                      │
│                                                         │
│  📋 users                (Usuários cadastrados)        │
│  ⏱️  time_entries        (Registros de ponto)          │
│  📅 absences            (Faltas, férias, licenças)    │
│  💰 transactions        (Transações financeiras)      │
│  🏦 accounts            (Contas bancárias)            │
│  📝 audit_logs          (Histórico de ações)          │
│  📂 categories          (Categorias de transações)    │
│  🔄 recurring_transactions (Transações recorrentes)   │
│  ⚙️  work_schedules      (Jornadas de trabalho)        │
│  🎯 goals               (Metas e objetivos)           │
│  ✅ balance_adjustments (Ajustes de saldo)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📖 Como Usar Cada Tabela

### 1️⃣ **Ver Usuários Cadastrados**

**Clique em**: `users`

**Você verá:**
- `id` = ID único do usuário
- `email` = Email da pessoa
- `name` = Nome completo
- `role` = Tipo (ADMIN, MANAGER, EMPLOYEE)
- `createdAt` = Quando foi cadastrado
- `updatedAt` = Última atualização

**Exemplo:**
```
id: "user_123"
email: colaborador@empresa.com
name: João Silva
role: EMPLOYEE
```

---

### 2️⃣ **Ver Registros de Ponto**

**Clique em**: `time_entries`

**Você verá:**
- `id` = ID do registro
- `userId` = Qual usuário fez
- `date` = Data do registro
- `time` = Hora exata
- `type` = Tipo de entrada (ENTRADA, SAIDA_ALMOCO, RETORNO_ALMOCO, SAIDA)
- `source` = Como foi registrado (MANUAL, PONTO_RAPIDO, etc)

**Exemplo:**
```
date: 2024-08-04
time: 08:00:00
type: ENTRADA
source: MANUAL
```

---

### 3️⃣ **Ver Transações Financeiras**

**Clique em**: `transactions`

**Você verá:**
- `id` = ID da transação
- `description` = O que foi a transação
- `type` = ENTRADA ou SAIDA
- `amountCents` = Valor em centavos (divide por 100 = reais)
- `date` = Data da transação
- `accountId` = Em qual conta

**Exemplo:**
```
description: "Supermercado"
type: SAIDA
amountCents: 15000 (= R$ 150,00)
date: 2024-08-01
```

---

### 4️⃣ **Ver Contas Bancárias**

**Clique em**: `accounts`

**Você verá:**
- `id` = ID da conta
- `name` = Nome (Nubank, Itaú, Carteira, etc)
- `type` = Tipo (CORRENTE, POUPANCA, CARTEIRA)
- `color` = Cor para identificação (#2a78d6, etc)
- `balance` = Saldo em centavos
- `archived` = Se foi deletada (true/false)

**Exemplo:**
```
name: "Nubank"
type: "CORRENTE"
color: "#2a78d6"
balance: 500000 (= R$ 5.000,00)
```

---

### 5️⃣ **Ver Ausências (Faltas, Férias)**

**Clique em**: `absences`

**Você verá:**
- `id` = ID da ausência
- `userId` = Qual usuário
- `type` = Tipo (FALTA_JUSTIFICADA, FALTA_INJUSTIFICADA, FERIAS, LICENCA, HOME_OFFICE, etc)
- `dateStart` = Início
- `dateEnd` = Fim
- `impact` = Como afeta (NEUTRO, DESCONTA, ABATE_BANCO, NAO_DESCONTA)
- `reason` = Motivo/descrição

**Exemplo:**
```
type: "FERIAS"
dateStart: 2024-08-15
dateEnd: 2024-08-25
impact: "NEUTRO"
```

---

### 6️⃣ **Ver Histórico de Ações (Auditoria)**

**Clique em**: `audit_logs`

**Você verá:**
- `id` = ID do log
- `userId` = Quem fez a ação
- `action` = O que foi feito (CREATE, UPDATE, DELETE, etc)
- `entity` = Em qual tabela (TIME_ENTRY, TRANSACTION, etc)
- `entityId` = ID do registro afetado
- `changes` = O que mudou (em JSON)
- `createdAt` = Quando ocorreu

**Exemplo:**
```
userId: "user_123"
action: "CREATE"
entity: "TRANSACTION"
entityId: "trans_456"
createdAt: 2024-08-04T10:30:00
```

---

## 🔍 Funcionalidades Principais

### **Filtrar Dados**

1. Clique em qualquer coluna
2. Use os filtros
3. Escolha data, texto, número, etc
4. Clique "Apply"

### **Ver Relacionamentos**

Quando você vê um `userId` ou `accountId`:

1. Clique nele
2. Será expandido mostrando os dados relacionados
3. Exemplo: clicar em `userId` mostra o usuário completo

### **Criar Novo Registro**

1. Clique no botão "+ Add record" no topo
2. Preencha os campos
3. Clique "Save"

### **Editar Registro**

1. Clique no registro
2. Edite os campos
3. Clique "Save"

### **Deletar Registro**

1. Clique no registro
2. Clique no ícone de lixeira
3. Confirme

⚠️ **CUIDADO**: Deletar é irreversível!

---

## 📱 Exemplos de Consultas Comuns

### **Quantos usuários estão cadastrados?**

1. Clique em `users`
2. Veja o número total no topo

### **Quais foram as transações de hoje?**

1. Clique em `transactions`
2. Clique em `date`
3. Filtrar para data de hoje
4. Clique "Apply"

### **Qual é o saldo total em todas as contas?**

1. Clique em `accounts`
2. Some todos os valores em `balance`
3. Divida por 100 para saber em reais

### **Quantas vezes João fez ponto este mês?**

1. Clique em `time_entries`
2. Filtrar por `userId` = João
3. Filtrar por `date` = mês atual
4. Veja quantos registros aparecem

---

## ⚙️ Configurações do Banco

| Configuração | Valor |
|-------------|-------|
| **Tipo** | PostgreSQL |
| **Provedor** | Neon (serverless) |
| **Host** | ep-mute-river-av76u7wg-pooler.c-11.us-east-1.aws.neon.tech |
| **Database** | neondb |
| **Usuário** | neondb_owner |
| **SSL** | Ativado (required) |
| **Pool** | PgBouncer (automático) |

---

## 🔧 Comandos Úteis

### **Iniciar Prisma Studio**

```bash
npm run db:studio
```

Abrirá automaticamente em http://localhost:5555

### **Parar Prisma Studio**

```
Ctrl+C no terminal onde rodou npm run db:studio
```

### **Fazer Migrations (Atualizar Schema)**

```bash
npm run db:migrate
```

### **Seed (Popular com Dados de Teste)**

```bash
npm run db:seed
```

### **Ver STATUS da Conexão**

```bash
npm run build
```

Se der erro, a conexão está com problema.

---

## 🐛 Troubleshooting

### **Problema: "Cannot reach database server"**

**Solução:**
1. Verificar conexão à internet
2. Neon pode estar down (https://status.neon.tech)
3. Executar: `npm run build` para validar

### **Problema: "Prisma Studio não abre"**

**Solução:**
1. Verifique se está rodando: `npm run db:studio`
2. Acesse: http://localhost:5555
3. Se der erro, reinicie: `Ctrl+C` e `npm run db:studio` novamente

### **Problema: "Port 5555 já em uso"**

**Solução:**
```bash
# Encontrar processo usando porta 5555
netstat -ano | findstr :5555

# Matar processo (Windows PowerShell)
Stop-Process -Id PROCESS_ID -Force

# Tentar novamente
npm run db:studio
```

### **Problema: "Sem permissão para deletar"**

**Solução:**
- Apenas admin pode deletar em produção
- Para testar localmente, use Neon console

---

## 📚 Dicas Pro

### **Exportar Dados**

1. Na tabela desejada
2. Clique com botão direito
3. Selecione "Export"
4. Escolha formato (CSV, JSON)

### **Copiar ID**

1. Clique no registro
2. ID aparece no topo
3. Copie com Ctrl+C

### **Verificar Relacionamentos**

Cada tabela tem conexões:
- `user` → `time_entries` (um usuário tem vários registros)
- `account` → `transactions` (uma conta tem várias transações)
- Clique para expandir

### **Buscar Rapidamente**

1. Use Ctrl+F na página do Studio
2. Procure pelo termo
3. O navegador vai destacar

---

## ✅ Status Atual

| Item | Status |
|------|--------|
| ✅ Banco conectado | OK - Neon serverless |
| ✅ Prisma Studio rodando | http://localhost:5555 |
| ✅ DATABASE_URL configurado | OK |
| ✅ Migrations realizadas | OK |
| ✅ Pronto para usar | SIM! |

---

## 🎯 Próximos Passos

1. **Abra**: http://localhost:5555
2. **Clique** em uma tabela (ex: `users`)
3. **Explore** os dados
4. **Edite**, **crie** ou **delete** registros conforme necessário
5. **Consulte** este guia sempre que precisar

---

## 📞 Dúvidas?

Cada tabela tem:
- ✅ Descrição de campos (passe o mouse)
- ✅ Filtros avançados
- ✅ Busca rápida
- ✅ Exportação de dados

**Tudo está pronto. Bora consultar! 🚀**

---

**Criado em**: 04/08/2026  
**Versão**: 1.0  
**Para**: Lucas Casotti

