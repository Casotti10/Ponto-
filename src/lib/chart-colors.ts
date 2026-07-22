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
