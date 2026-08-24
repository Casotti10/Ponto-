import { z } from "zod";
import { parseAmountToCents } from "@/lib/ledger-calc";

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Regras de senha forte, aplicadas no cadastro.
 *
 * O piso de 8 caracteres com quatro classes distintas segue a recomendacao
 * do NIST SP 800-63B para quando nao ha verificacao contra listas de senhas
 * vazadas. O limite superior de 72 nao e estetico: o bcrypt TRUNCA em 72
 * bytes, entao aceitar mais criaria a ilusao de uma senha mais forte do que
 * a que seria de fato verificada.
 *
 * Cada regra e uma mensagem separada para que o usuario saiba exatamente o
 * que falta, em vez de receber um "senha invalida" generico.
 */
export const strongPasswordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .max(72, "A senha deve ter no máximo 72 caracteres")
  .regex(/[a-z]/, "A senha deve conter ao menos uma letra minúscula")
  .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula")
  .regex(/[0-9]/, "A senha deve conter ao menos um número")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial");

export const registerSchema = z
  .object({
    name: z.string().min(2, "Informe seu nome completo").max(120),
    email: z.string().email("Informe um e-mail válido"),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })
  // A senha nao pode conter o nome nem o usuario do e-mail: sao os dois
  // palpites mais obvios de quem conhece a pessoa.
  .refine(
    (data) => {
      const senha = data.password.toLowerCase();
      const usuario = data.email.split("@")[0]?.toLowerCase() ?? "";
      const nome = data.name.trim().toLowerCase().split(/\s+/)[0] ?? "";
      if (usuario.length >= 4 && senha.includes(usuario)) return false;
      if (nome.length >= 4 && senha.includes(nome)) return false;
      return true;
    },
    { message: "A senha não pode conter seu nome ou e-mail", path: ["password"] }
  );
export type RegisterInput = z.infer<typeof registerSchema>;

export const profileSchema = z.object({
  name: z.string().min(2, "Informe seu nome completo").max(120),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Schema para alteração de senha.
 * Valida:
 * 1. Senha atual (deve existir e ser válida)
 * 2. Nova senha (deve ser forte)
 * 3. Confirmação (deve ser igual à nova)
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual"),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As novas senhas não coincidem",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "A nova senha não pode ser igual à senha atual",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const timeEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Informe a data"),
  time: z.string().min(1, "Informe o horário"),
  type: z.enum(["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type TimeEntryInput = z.infer<typeof timeEntrySchema>;

export const dayEntriesSchema = z
  .object({
    date: z.string().min(1, "Informe a data"),
    ENTRADA: z.string().optional().or(z.literal("")),
    SAIDA_ALMOCO: z.string().optional().or(z.literal("")),
    RETORNO_ALMOCO: z.string().optional().or(z.literal("")),
    SAIDA: z.string().optional().or(z.literal("")),
    notes: z.string().max(500).optional().or(z.literal("")),
  })
  .refine((data) => [data.ENTRADA, data.SAIDA_ALMOCO, data.RETORNO_ALMOCO, data.SAIDA].some((t) => !!t), {
    message: "Informe ao menos um horário",
    path: ["ENTRADA"],
  });
export type DayEntriesInput = z.infer<typeof dayEntriesSchema>;

export const absenceSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Informe a data inicial"),
  endDate: z.string().optional().or(z.literal("")),
  type: z.enum([
    "FALTA_JUSTIFICADA",
    "FALTA_INJUSTIFICADA",
    "BANCO_HORAS",
    "FOLGA",
    "FERIAS",
    "LICENCA",
    "COMPENSACAO",
    "HOME_OFFICE",
  ]),
  hours: z.coerce.number().min(0).max(24).optional(),
  reason: z.string().max(500).optional().or(z.literal("")),
});
export type AbsenceInput = z.infer<typeof absenceSchema>;

export const balanceAdjustmentSchema = z.object({
  minutes: z.coerce.number().refine((v) => v !== 0, "Informe uma quantidade de minutos diferente de zero"),
  reason: z.string().min(3, "Informe o motivo do ajuste").max(500),
  date: z.string().optional().or(z.literal("")),
});
export type BalanceAdjustmentInput = z.infer<typeof balanceAdjustmentSchema>;

export const workScheduleSchema = z.object({
  dailyHours: z.coerce.number().min(1).max(24),
  weeklyHours: z.coerce.number().min(1).max(168),
  lunchBreakMinutes: z.coerce.number().min(0).max(480),
  toleranceMinutes: z.coerce.number().min(0).max(120),
  workDays: z.array(z.number().min(0).max(6)).min(1),
  entryTime: z.string(),
  lunchOutTime: z.string(),
  lunchReturnTime: z.string(),
  exitTime: z.string(),
});
export type WorkScheduleInput = z.infer<typeof workScheduleSchema>;

export const goalSchema = z.object({
  title: z.string().min(2).max(200),
  targetHours: z.coerce.number().min(0).max(1000),
  year: z.coerce.number(),
  month: z.coerce.number().min(1).max(12),
});
export type GoalInput = z.infer<typeof goalSchema>;

/* ----------------------- Razão financeiro (entradas/saídas) ---------------- */

/**
 * O valor chega como texto do formulário ("1.234,56") e é convertido para
 * centavos inteiros. A conversão vive em `ledger-calc` para que a mesma regra
 * valha no cliente (preview) e no servidor (gravação).
 */
const amountCents = z.string().min(1, "Informe o valor").transform((value, ctx) => {
  const cents = parseAmountToCents(value);
  if (cents === null || cents <= 0) {
    ctx.addIssue({ code: "custom", message: "Informe um valor válido maior que zero" });
    return z.NEVER;
  }
  return cents;
});

export const transactionStatus = z.enum(["PENDENTE", "LIQUIDADO", "AGENDADO", "CANCELADO"]);

export const paymentMethod = z.enum([
  "DINHEIRO",
  "PIX",
  "DEBITO",
  "CREDITO",
  "BOLETO",
  "TRANSFERENCIA",
  "OUTRO",
]);

export const transactionSchema = z.object({
  id: z.string().optional(),
  /** COMPETÊNCIA: o mês a que o lançamento pertence. É ela que recorta a visão mensal. */
  date: z.string().min(1, "Informe a data"),
  description: z.string().min(1, "Informe a descrição").max(200),
  amount: amountCents,
  type: z.enum(["ENTRADA", "SAIDA"]),
  accountId: z.string().min(1, "Selecione a conta"),
  categoryId: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  /** Ausente = LIQUIDADO, que é como o módulo se comportava antes da coluna. */
  status: transactionStatus.optional(),
  /** Vencimento. Vazio significa "vence na data de competência". */
  dueDate: z.string().optional().or(z.literal("")),
  /** Data em que o dinheiro se moveu. Só faz sentido quando LIQUIDADO. */
  settledDate: z.string().optional().or(z.literal("")),
  paymentMethod: paymentMethod.optional().or(z.literal("")),
});
export type TransactionInput = z.infer<typeof transactionSchema>;

export const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Informe o nome da conta").max(60),
  type: z.enum(["CORRENTE", "POUPANCA", "CARTEIRA", "CARTAO", "INVESTIMENTO"]),
  openingBalance: z.string().optional().or(z.literal("")),
  color: z.string().min(4).max(9),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Informe o nome da categoria").max(60),
  type: z.enum(["ENTRADA", "SAIDA"]),
  color: z.string().min(4).max(9),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const recurringTransactionSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Informe a descrição").max(200),
  amount: amountCents,
  type: z.enum(["ENTRADA", "SAIDA"]),
  accountId: z.string().min(1, "Selecione a conta"),
  categoryId: z.string().optional().or(z.literal("")),
  frequency: z.enum(["MENSAL", "SEMANAL", "ANUAL"]),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  weekday: z.coerce.number().int().min(0).max(6),
  monthOfYear: z.coerce.number().int().min(1).max(12),
  startDate: z.string().min(1, "Informe a data de início"),
  endDate: z.string().optional().or(z.literal("")),
});
export type RecurringTransactionInput = z.infer<typeof recurringTransactionSchema>;

/* --------------------------- Quadro de tarefas ---------------------------- */

/**
 * Cor em hexadecimal. O formulário só oferece a paleta validada, mas a action
 * não pode confiar nisso — o valor chega por FormData e pode ser forjado.
 */
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor válida");

export const taskPriorityEnum = z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]);

export const boardSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Informe o nome do quadro").max(80),
  description: z.string().max(300).optional().or(z.literal("")),
});
export type BoardInput = z.infer<typeof boardSchema>;

export const boardColumnSchema = z.object({
  id: z.string().optional(),
  boardId: z.string().min(1),
  name: z.string().min(1, "Informe o nome da coluna").max(60),
  color: hexColor,
  // Checkbox só envia valor quando marcado, por isso o default.
  isDone: z.coerce.boolean().default(false),
});
export type BoardColumnInput = z.infer<typeof boardColumnSchema>;

export const taskCardSchema = z.object({
  id: z.string().optional(),
  columnId: z.string().min(1, "Selecione a coluna"),
  title: z.string().min(1, "Informe o título da tarefa").max(200),
  description: z.string().max(500).optional().or(z.literal("")),
  priority: taskPriorityEnum,
  dueDate: z.string().optional().or(z.literal("")),
  color: hexColor.optional().or(z.literal("")),
  /** Ids separados por vírgula — é como o formulário serializa a seleção. */
  labelIds: z.string().optional().or(z.literal("")),
});
export type TaskCardInput = z.infer<typeof taskCardSchema>;

export const taskLabelSchema = z.object({
  id: z.string().optional(),
  boardId: z.string().min(1),
  name: z.string().min(1, "Informe o nome da etiqueta").max(40),
  color: hexColor,
});
export type TaskLabelInput = z.infer<typeof taskLabelSchema>;

export const checklistItemSchema = z.object({
  content: z.string().min(1, "Descreva o item").max(300),
});

export const cardNotesSchema = z.object({
  // 20 mil caracteres é folgado para anotação de tarefa e ainda barra colar um
  // arquivo inteiro no campo.
  content: z.string().max(20000, "A anotação ficou longa demais"),
});

export const reportRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});

/** Compra parcelada: gera N lançamentos, um por mês. */
export const installmentSchema = z.object({
  description: z.string().min(1, "Informe a descrição").max(180),
  /** Valor TOTAL da compra, não o da parcela. */
  amount: amountCents,
  count: z.coerce.number().int().min(2, "Parcelamento começa em 2 vezes").max(72, "Máximo de 72 parcelas"),
  firstDueDate: z.string().min(1, "Informe o vencimento da primeira parcela"),
  type: z.enum(["ENTRADA", "SAIDA"]),
  accountId: z.string().min(1, "Selecione a conta"),
  categoryId: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

/** Transferência entre contas do próprio usuário. */
export const transferSchema = z.object({
  fromAccountId: z.string().min(1, "Selecione a conta de origem"),
  toAccountId: z.string().min(1, "Selecione a conta de destino"),
  amount: amountCents,
  date: z.string().min(1, "Informe a data"),
  description: z.string().max(180).optional().or(z.literal("")),
});
