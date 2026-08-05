"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Arrastar e soltar do quadro, sobre Pointer Events.
 *
 * Não usa a API nativa de drag and drop do HTML nem uma biblioteca: a API
 * nativa não funciona em toque (mobile ficaria sem o recurso principal da tela)
 * e uma biblioteca de DnD seria a primeira dependência de UI do projeto para
 * resolver um problema que Pointer Events já resolve — o mesmo evento cobre
 * mouse, toque e caneta.
 *
 * O desenho é o de reordenação ao vivo: o card arrastado CONTINUA na lista,
 * ocupando seu espaço como uma silhueta, e a lista real é reordenada enquanto o
 * ponteiro se move. É o que mantém a medição estável — o alvo é calculado a
 * partir do layout que o usuário está vendo, e não de um retângulo capturado no
 * início que envelhece a cada rolagem.
 */

const DRAG_THRESHOLD_PX = 5;
/** Faixa junto à borda em que a rolagem automática começa. */
const AUTOSCROLL_EDGE_PX = 72;
const AUTOSCROLL_MAX_SPEED = 20;

export interface DragTarget {
  columnId: string;
  index: number;
}

export interface DragState {
  cardId: string;
  /** Canto superior esquerdo da prévia flutuante, já em coordenadas de tela. */
  x: number;
  y: number;
  width: number;
  height: number;
  target: DragTarget;
}

interface Session {
  pointerId: number;
  cardId: string;
  originColumnId: string;
  originIndex: number;
  startX: number;
  startY: number;
  /** Distância entre o ponto agarrado e o canto do card. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  pointerX: number;
  pointerY: number;
  target: DragTarget;
  active: boolean;
  frame: number | null;
}

interface Options {
  /** Reordena o estado local durante o arrasto (prévia). */
  onMove: (cardId: string, toColumnId: string, toIndex: number) => void;
  /** Persiste a posição final. Só é chamado se algo de fato mudou. */
  onDrop: (cardId: string, toColumnId: string, toIndex: number) => void;
  /** Container com rolagem horizontal das colunas. */
  scrollerRef: RefObject<HTMLElement | null>;
}

export function useBoardDnd({ onMove, onDrop, scrollerRef }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const columnRefs = useRef(new Map<string, HTMLElement>());
  const listRefs = useRef(new Map<string, HTMLElement>());
  /**
   * Marca que o último pointerup encerrou um arrasto. O clique que o navegador
   * dispara em seguida abriria o card que a pessoa acabou de soltar.
   */
  const suppressClickRef = useRef(false);

  // Guardados em ref para que os listeners de window, registrados uma única vez,
  // sempre enxerguem a versão atual sem precisar ser reatados a cada render.
  const handlersRef = useRef({ onMove, onDrop });
  useEffect(() => {
    handlersRef.current = { onMove, onDrop };
  });

  /* ------------------------------- Registros ------------------------------ */

  const registerColumn = useCallback(
    (columnId: string) => (el: HTMLElement | null) => {
      if (el) columnRefs.current.set(columnId, el);
      else columnRefs.current.delete(columnId);
    },
    []
  );

  const registerList = useCallback(
    (columnId: string) => (el: HTMLElement | null) => {
      if (el) listRefs.current.set(columnId, el);
      else listRefs.current.delete(columnId);
    },
    []
  );

  /* -------------------------------- Medição ------------------------------- */

  /**
   * Descobre em que coluna e em que posição o card cairia agora.
   *
   * O card arrastado é ignorado na contagem: o índice devolvido é o da lista
   * SEM ele, que é exatamente o que `moveId` espera receber.
   */
  const computeTarget = useCallback((x: number, y: number, cardId: string): DragTarget | null => {
    let columnId: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [id, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right) {
        columnId = id;
        break;
      }
      // Fora de qualquer coluna (entre duas, ou além da última) o alvo é a
      // coluna mais próxima na horizontal — soltar nunca vira "não fez nada".
      const distance = x < rect.left ? rect.left - x : x - rect.right;
      if (distance < bestDistance) {
        bestDistance = distance;
        columnId = id;
      }
    }

    if (!columnId) return null;

    const list = listRefs.current.get(columnId);
    if (!list) return { columnId, index: 0 };

    let index = 0;
    for (const el of list.querySelectorAll<HTMLElement>("[data-card-id]")) {
      if (el.dataset.cardId === cardId) continue;
      const rect = el.getBoundingClientRect();
      if (y > rect.top + rect.height / 2) index += 1;
    }

    return { columnId, index };
  }, []);

  /* --------------------------- Rolagem automática -------------------------- */

  const autoScroll = useCallback(
    (x: number, y: number, columnId: string) => {
      const speed = (distance: number) =>
        Math.min(AUTOSCROLL_MAX_SPEED, Math.ceil(distance / 3));

      const scroller = scrollerRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        if (x < rect.left + AUTOSCROLL_EDGE_PX) {
          scroller.scrollLeft -= speed(rect.left + AUTOSCROLL_EDGE_PX - x);
        } else if (x > rect.right - AUTOSCROLL_EDGE_PX) {
          scroller.scrollLeft += speed(x - (rect.right - AUTOSCROLL_EDGE_PX));
        }
      }

      const list = listRefs.current.get(columnId);
      if (list && list.scrollHeight > list.clientHeight) {
        const rect = list.getBoundingClientRect();
        if (y < rect.top + AUTOSCROLL_EDGE_PX) {
          list.scrollTop -= speed(rect.top + AUTOSCROLL_EDGE_PX - y);
        } else if (y > rect.bottom - AUTOSCROLL_EDGE_PX) {
          list.scrollTop += speed(y - (rect.bottom - AUTOSCROLL_EDGE_PX));
        }
      }
    },
    [scrollerRef]
  );

  /* ------------------------------- Ciclo ---------------------------------- */

  const stop = useCallback((session: Session) => {
    if (session.frame !== null) cancelAnimationFrame(session.frame);
    sessionRef.current = null;
    setDrag(null);
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
  }, []);

  /**
   * Começa a acompanhar o ponteiro. O arrasto só é ativado depois de alguns
   * pixels de movimento — sem isso, todo clique para abrir um card viraria um
   * micro-arrasto.
   */
  const startCardDrag = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      card: { cardId: string; columnId: string; index: number }
    ) => {
      if (event.button !== 0 || sessionRef.current) return;

      const element = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-card-id]");
      if (!element) return;

      const rect = element.getBoundingClientRect();

      sessionRef.current = {
        pointerId: event.pointerId,
        cardId: card.cardId,
        originColumnId: card.columnId,
        originIndex: card.index,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        pointerX: event.clientX,
        pointerY: event.clientY,
        target: { columnId: card.columnId, index: card.index },
        active: false,
        frame: null,
      };
    },
    []
  );

  /* ------------------------ Listeners globais do arrasto ------------------- */

  // Todo o ciclo do arrasto vive neste efeito: o laço de animação chama a si
  // mesmo, e declará-lo aqui evita a referência circular que um `useCallback`
  // exigiria só para se autorreferenciar.
  useEffect(() => {
    function tick() {
      const session = sessionRef.current;
      if (!session?.active) return;

      autoScroll(session.pointerX, session.pointerY, session.target.columnId);

      const target = computeTarget(session.pointerX, session.pointerY, session.cardId);
      if (
        target &&
        (target.columnId !== session.target.columnId || target.index !== session.target.index)
      ) {
        session.target = target;
        handlersRef.current.onMove(session.cardId, target.columnId, target.index);
      }

      setDrag({
        cardId: session.cardId,
        x: session.pointerX - session.offsetX,
        y: session.pointerY - session.offsetY,
        width: session.width,
        height: session.height,
        target: session.target,
      });

      session.frame = requestAnimationFrame(tick);
    }

    function finish(commit: boolean) {
      const session = sessionRef.current;
      if (!session) return;

      const wasActive = session.active;
      const { cardId, target, originColumnId, originIndex } = session;
      stop(session);

      if (!wasActive) return;

      // O navegador dispara um clique logo depois do pointerup; a trava existe
      // para ele. Ela é liberada no próximo tique porque o clique nem sempre
      // chega — soltar sobre outra coluna não gera clique no card de origem, e
      // uma trava esquecida engoliria o próximo clique de verdade.
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);

      if (commit) {
        const unchanged = target.columnId === originColumnId && target.index === originIndex;
        // Soltar no mesmo lugar não é uma alteração: evita uma escrita e uma
        // linha de histórico a cada vez que alguém pega um card e desiste.
        if (!unchanged) handlersRef.current.onDrop(cardId, target.columnId, target.index);
      } else {
        handlersRef.current.onMove(cardId, originColumnId, originIndex);
      }
    }

    function handleMove(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;

      session.pointerX = event.clientX;
      session.pointerY = event.clientY;

      if (!session.active) {
        const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
        if (distance < DRAG_THRESHOLD_PX) return;

        session.active = true;
        document.body.style.setProperty("user-select", "none");
        document.body.style.setProperty("cursor", "grabbing");
        session.frame = requestAnimationFrame(tick);
      }

      // Impede que o toque role a página enquanto o card está sendo carregado.
      if (event.cancelable) event.preventDefault();
    }

    function handleUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      finish(true);
    }

    function handleCancel(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      finish(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && sessionRef.current) finish(false);
    }

    // `passive: false` é o que permite o preventDefault acima valer no toque.
    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKey);
    };
  }, [autoScroll, computeTarget, stop]);

  // Se o componente sair da tela no meio de um arrasto, os estilos globais
  // precisam voltar — senão a página fica sem seleção de texto e com o cursor
  // de "agarrando" para sempre.
  useEffect(() => {
    return () => {
      const session = sessionRef.current;
      if (session) stop(session);
    };
  }, [stop]);

  /** Consome a supressão: devolve true quando o clique deve ser ignorado. */
  const consumeClickSuppression = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    drag,
    startCardDrag,
    registerColumn,
    registerList,
    consumeClickSuppression,
    isDragging: drag !== null,
  };
}
