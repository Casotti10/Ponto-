"use client";

import { useState } from "react";
import { Ban, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_PALETTE } from "@/lib/task-calc";

/**
 * Seletor de cor do quadro (cards, colunas e etiquetas).
 *
 * Usa a mesma paleta verificada dos gráficos do financeiro e, como lá, não é um
 * `<input type="color">`: cor livre quebraria o contraste do texto sobre a
 * etiqueta e a separação entre cores sob daltonismo.
 *
 * A diferença para o seletor do razão é a opção "sem cor" — card colorido é
 * destaque, e destacar tudo é o mesmo que não destacar nada.
 */
export function TaskColorPicker({
  name,
  defaultValue,
  allowEmpty = false,
  onChange,
}: {
  /** Quando presente, a cor é enviada junto com o formulário. */
  name?: string;
  defaultValue: string;
  allowEmpty?: boolean;
  /** Para uso fora de formulário, como nas edições rápidas do drawer. */
  onChange?: (color: string) => void;
}) {
  const [selected, setSelected] = useState(
    TASK_PALETTE.includes(defaultValue) ? defaultValue : allowEmpty ? "" : TASK_PALETTE[0]
  );

  function choose(color: string) {
    setSelected(color);
    onChange?.(color);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {name && <input type="hidden" name={name} value={selected} />}

      {allowEmpty && (
        <button
          type="button"
          onClick={() => choose("")}
          aria-label="Sem cor"
          aria-pressed={selected === ""}
          title="Sem cor"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border-2 bg-muted transition-transform hover:scale-105",
            selected === "" ? "border-foreground" : "border-transparent"
          )}
        >
          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      {TASK_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => choose(color)}
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
