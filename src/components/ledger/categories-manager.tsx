"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColorPicker } from "@/components/ledger/color-picker";
import { deleteCategory, saveCategory } from "@/lib/actions/ledger";

export interface CategoryItem {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA";
  color: string;
}

export function CategoriesManager({ categories }: { categories: CategoryItem[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [open, setOpen] = useState(false);
  const [formType, setFormType] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [listType, setListType] = useState<"ENTRADA" | "SAIDA">("SAIDA");

  const visible = categories.filter((c) => c.type === listType);

  function openNew() {
    setEditing(null);
    setFormType(listType);
    setOpen(true);
  }

  function openEdit(category: CategoryItem) {
    setEditing(category);
    setFormType(category.type);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveCategory(formData);
      if (result.success) {
        toast.success(editing ? "Categoria atualizada" : "Categoria criada");
        setOpen(false);
      } else {
        toast.error(result.error ?? "Não foi possível salvar");
      }
    });
  }

  function handleDelete(category: CategoryItem) {
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.success) toast.success("Categoria excluída");
      else toast.error(result.error ?? "Não foi possível excluir");
    });
  }

  return (
    <div className="space-y-3">
      <Tabs value={listType} onValueChange={(v) => v && setListType(v as "ENTRADA" | "SAIDA")}>
        <TabsList>
          <TabsTrigger value="SAIDA">Saídas</TabsTrigger>
          <TabsTrigger value="ENTRADA">Entradas</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma categoria deste tipo.</p>
        )}
        {visible.map((category) => (
          <div
            key={category.id}
            className="group flex items-center gap-2 rounded-lg border py-1 pr-1 pl-2.5 text-sm"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: category.color }}
            />
            {category.name}
            <span className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => openEdit(category)}
                aria-label={`Editar ${category.name}`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={pending}
                onClick={() => handleDelete(category)}
                aria-label={`Excluir ${category.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </span>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={openNew}>
        <Plus className="h-4 w-4" /> Nova categoria
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSubmit} key={editing?.id ?? "new"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
              <DialogDescription>
                Excluir uma categoria não apaga os lançamentos — eles passam a contar como
                &quot;Sem categoria&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <input type="hidden" name="type" value={formType} />

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Tabs value={formType} onValueChange={(v) => v && setFormType(v as "ENTRADA" | "SAIDA")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="SAIDA" className="flex-1">
                      Saída
                    </TabsTrigger>
                    <TabsTrigger value="ENTRADA" className="flex-1">
                      Entrada
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-name">Nome</Label>
                <Input
                  id="category-name"
                  name="name"
                  required
                  maxLength={60}
                  placeholder="Ex: Mercado"
                  defaultValue={editing?.name ?? ""}
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <ColorPicker name="color" defaultValue={editing?.color ?? "#2a78d6"} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
