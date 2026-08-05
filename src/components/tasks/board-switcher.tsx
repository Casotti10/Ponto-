"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteBoard, saveBoard } from "@/lib/actions/tasks";
import type { BoardSummary } from "@/lib/task-service";

interface Props {
  boards: BoardSummary[];
  current: BoardSummary;
}

/**
 * Troca de quadro e CRUD do próprio quadro.
 *
 * O quadro ativo vive na URL (`?quadro=`), e não em estado do cliente: assim o
 * link pode ser salvo nos favoritos, o botão voltar funciona e a página
 * continua sendo renderizada no servidor com os dados certos.
 */
export function BoardSwitcher({ boards, current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const items = Object.fromEntries(boards.map((board) => [board.id, board.name]));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveBoard(formData);
      if (result.success) {
        toast.success(editing ? "Quadro atualizado" : "Quadro criado");
        setFormOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível salvar o quadro");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBoard(current.id);
      if (result.success) {
        toast.success("Quadro excluído");
        setDeleteOpen(false);
        // Sai do quadro que deixou de existir; o servidor resolve o padrão.
        router.push("/tarefas");
      } else {
        toast.error(result.error ?? "Não foi possível excluir");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        items={items}
        value={current.id}
        onValueChange={(value) => value && router.push(`/tarefas?quadro=${value}`)}
      >
        <SelectTrigger className="w-48" aria-label="Selecionar quadro">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {boards.map((board) => (
            <SelectItem key={board.id} value={board.id}>
              {board.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        aria-label="Editar quadro"
        onClick={() => {
          setEditing(true);
          setFormOpen(true);
        }}
      >
        <Pencil />
      </Button>

      <Button
        variant="outline"
        size="icon"
        aria-label="Novo quadro"
        onClick={() => {
          setEditing(false);
          setFormOpen(true);
        }}
      >
        <Plus />
      </Button>

      <Button
        variant="outline"
        size="icon"
        aria-label="Excluir quadro"
        disabled={boards.length <= 1}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 />
      </Button>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit} key={editing ? current.id : "novo"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar quadro" : "Novo quadro"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Ajuste o nome e a descrição deste quadro."
                  : "Um quadro novo já vem com as colunas A Fazer, Em Andamento e Concluído."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editing && <input type="hidden" name="id" value={current.id} />}

              <div className="space-y-2">
                <Label htmlFor="board-name">Nome</Label>
                <Input
                  id="board-name"
                  name="name"
                  required
                  autoFocus
                  maxLength={80}
                  placeholder="Ex: Projetos pessoais"
                  defaultValue={editing ? current.name : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="board-description">Descrição (opcional)</Label>
                <Textarea
                  id="board-description"
                  name="description"
                  rows={2}
                  maxLength={300}
                  defaultValue={editing ? (current.description ?? "") : ""}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o quadro &quot;{current.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as colunas, cards, checklists, anotações e o histórico deste quadro serão
              apagados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={pending}>
              Excluir quadro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
