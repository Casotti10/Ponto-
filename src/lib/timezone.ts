/**
 * Fuso horário do app.
 *
 * Horário de ponto é gravado e lido como "relógio de parede": o valor no banco
 * carrega os componentes (ano/mês/dia/hora/minuto) que o usuário vê na tela, e
 * a leitura os recupera com os getters locais (`format`, `getHours`). É a
 * convenção que `combineDateTime` já usa ao montar um registro manual a partir
 * dos campos do formulário.
 *
 * O ponto cego dessa convenção é o "agora": `new Date()` devolve o relógio DO
 * SERVIDOR — UTC na Vercel, `America/Sao_Paulo` na máquina de desenvolvimento.
 * Gravar esse valor direto registra um relógio de parede que não é o do
 * usuário: em produção, três horas adiantado.
 *
 * As funções abaixo resolvem o instante atual no fuso do app e o devolvem já na
 * convenção local, para que registro rápido, registro manual e o cálculo do dia
 * falem a mesma língua em qualquer ambiente.
 *
 * `NEXT_PUBLIC_` no nome da variável não é descuido: o valor é inlinado no
 * bundle, então o relógio da tela de ponto e os campos do formulário usam
 * exatamente o mesmo fuso que o servidor grava.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Sao_Paulo";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wallClock(instant: Date) {
  const parts = new Map<string, string>();
  for (const part of partsFormatter.formatToParts(instant)) {
    parts.set(part.type, part.value);
  }
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    time: `${parts.get("hour")}:${parts.get("minute")}`,
    seconds: parts.get("second") ?? "00",
  };
}

/** Data de hoje no fuso do app, em `yyyy-MM-dd` — formato do `<input type="date">`. */
export function appDateString(instant: Date = new Date()) {
  return wallClock(instant).date;
}

/** Hora atual no fuso do app, em `HH:mm` — formato do `<input type="time">`. */
export function appTimeString(instant: Date = new Date()) {
  return wallClock(instant).time;
}

/** Hora atual no fuso do app, em `HH:mm:ss` — o relógio da tela de ponto. */
export function appClockString(instant: Date = new Date()) {
  const { time, seconds } = wallClock(instant);
  return `${time}:${seconds}`;
}

/**
 * "Agora" na convenção de `TimeEntry.time`: um Date cujos componentes locais
 * são o relógio de parede do fuso do app.
 */
export function appNow(instant: Date = new Date()) {
  const { date, time, seconds } = wallClock(instant);
  // Sem sufixo de fuso a string é interpretada como horário local — é
  // justamente isso que faz os componentes do Date baterem com o relógio do
  // usuário, do mesmo jeito que `new Date(\`${data}T00:00:00\`)` faz nas
  // actions de registro manual.
  return new Date(`${date}T${time}:${seconds}`);
}

/** Meia-noite de hoje na convenção de `TimeEntry.date`. */
export function appToday(instant: Date = new Date()) {
  return new Date(`${wallClock(instant).date}T00:00:00`);
}
