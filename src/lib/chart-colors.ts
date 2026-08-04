export interface ChartPalette {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  gridline: string;
  baseline: string;
  positive: string;
  negative: string;
  accent: string;
  successText: string;
}

/**
 * Cores semânticas do razão financeiro. Entrada e saída têm papel fixo e nunca
 * são recicladas para outra coisa.
 */
export interface LedgerPalette {
  income: string;
  expense: string;
  balance: string;
  projection: string;
}

export const ledgerColors: { light: LedgerPalette; dark: LedgerPalette } = {
  light: { income: "#1baf7a", expense: "#e34948", balance: "#2a78d6", projection: "#c3c2b7" },
  dark: { income: "#199e70", expense: "#e05252", balance: "#3987e5", projection: "#383835" },
};

/**
 * Paleta categórica das categorias de gasto/receita, em ORDEM FIXA.
 *
 * Verificada por ferramenta em ambos os temas (banda de luminosidade, croma,
 * separação sob protan/deutan/tritan, piso de visão normal e contraste). O par
 * verde↔vermelho cai na faixa 6–8 de separação sob daltonismo, o que só é
 * legítimo com codificação secundária — por isso todo gráfico de categoria
 * neste módulo carrega rótulo direto com nome e valor, além da tabela.
 *
 * São 6 slots de propósito: a partir do 7º item o gráfico agrupa o excedente em
 * "Outros", em vez de inventar cor nova.
 */
export const categoryPalette: { light: string[]; dark: string[] } = {
  light: ["#2a78d6", "#e34948", "#1baf7a", "#eda100", "#4a3aa7", "#e87ba4"],
  dark: ["#3987e5", "#e05252", "#199e70", "#b8831a", "#8b7dea", "#c96a92"],
};

/** Cor neutra do agrupamento "Outros" / "Sem categoria". */
export const categoryFallbackColor = { light: "#898781", dark: "#898781" };

export const chartColors: { light: ChartPalette; dark: ChartPalette } = {
  light: {
    surface: "#fcfcfb",
    textPrimary: "#0b0b0b",
    textSecondary: "#52514e",
    muted: "#898781",
    gridline: "#e1e0d9",
    baseline: "#c3c2b7",
    positive: "#2a78d6",
    negative: "#e34948",
    accent: "#1baf7a",
    successText: "#006300",
  },
  dark: {
    surface: "#1a1a19",
    textPrimary: "#ffffff",
    textSecondary: "#c3c2b7",
    muted: "#898781",
    gridline: "#2c2c2a",
    baseline: "#383835",
    positive: "#3987e5",
    negative: "#e66767",
    accent: "#199e70",
    successText: "#0ca30c",
  },
};
