"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryPalette, categoryFallbackColor } from "@/lib/chart-colors";

/**
 * Seletor de cor limitado à paleta validada.
 *
 * Deliberadamente NÃO é um `<input type="color">`: cor escolhida à mão quebra a
 * garantia de contraste e de separação sob daltonismo que a paleta do módulo
 * tem. Oferecer só os slots aprovados mantém os gráficos legíveis por
 * construção, sem depender do bom gosto de quem cadastra.
 */
export function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const options = [...categoryPalette.light, categoryFallbackColor.light];
  const [selected, setSelected] = useState(
    options.includes(defaultValue) ? defaultValue : options[0]
  );

  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={selected} />
      {options.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => setSelected(color)}
          aria-label={`Cor ${color}`}
          aria-pressed={selected === color}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-transform hover:scale-105",
            selected === color ? "border-foreground" : "border-transparent"
          )}
          style={{ backgroundColor: color }}
        >
          {selected === color && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}
