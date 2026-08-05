"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichText } from "@/components/tasks/rich-text";
import { saveCardNotes } from "@/lib/actions/tasks";

/** Silêncio de digitação que dispara a gravação. */
const AUTOSAVE_DELAY_MS = 900;

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Área de anotações do card, com salvamento automático.
 *
 * Não há botão "salvar" de propósito: a anotação é rascunho de trabalho, e
 * perder o texto por ter fechado o drawer seria a pior falha possível aqui. O
 * envio sai depois de uma pausa na digitação e também no desmonte do
 * componente, que cobre fechar o drawer no meio de uma frase.
 *
 * `initialContent` vale só na montagem. Quem renderiza passa `key={cardId}`,
 * então trocar de card remonta o componente — o que evita um efeito de
 * sincronização que poderia sobrescrever o que está sendo digitado.
 */
export function CardNotes({ cardId, initialContent }: { cardId: string; initialContent: string }) {
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O que já está gravado no servidor. Evita reenviar texto idêntico e permite
  // decidir, no desmonte, se há algo pendente.
  const persistedRef = useRef(initialContent);
  const contentRef = useRef(initialContent);

  const persist = useCallback(
    async (value: string) => {
      if (value === persistedRef.current) return;
      setState("saving");
      const result = await saveCardNotes(cardId, value);
      if (result.success) {
        persistedRef.current = value;
        setSavedAt(new Date());
        setState("saved");
      } else {
        setState("error");
      }
    },
    [cardId]
  );

  function handleChange(value: string) {
    setContent(value);
    contentRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(value), AUTOSAVE_DELAY_MS);
  }

  // Fechar o drawer desmonta este componente. Se o temporizador ainda não tinha
  // disparado, o texto vai agora — sem depender de a tela continuar montada.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (contentRef.current !== persistedRef.current) {
        void saveCardNotes(cardId, contentRef.current);
      }
    };
  }, [cardId]);

  return (
    <div className="space-y-2">
      <Tabs defaultValue="escrever">
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="escrever">Escrever</TabsTrigger>
            <TabsTrigger value="visualizar">Visualizar</TabsTrigger>
          </TabsList>

          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {state === "saving" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
              </>
            )}
            {state === "saved" && savedAt && (
              <>
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Salvo às {format(savedAt, "HH:mm")}
              </>
            )}
            {state === "error" && (
              <span className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3 w-3" /> Falha ao salvar
              </span>
            )}
          </span>
        </div>

        <TabsContent value="escrever" className="mt-3">
          <Textarea
            value={content}
            onChange={(event) => handleChange(event.target.value)}
            rows={12}
            maxLength={20000}
            placeholder={"Documente a tarefa aqui.\n\n# Título\n- item de lista\n**negrito**, *itálico*, `código` e [link](https://exemplo.com)"}
            className="min-h-64 font-mono text-xs leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Salva sozinho enquanto você escreve. Aceita marcação leve — veja o resultado na aba
            Visualizar.
          </p>
        </TabsContent>

        <TabsContent value="visualizar" className="mt-3">
          <div className="min-h-64 rounded-lg border p-3">
            <RichText content={content} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
