"use client";

import { useActionState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { registerAction } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ActionState = {};

export default function CadastroPage() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-emerald-50 px-4 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl animate-pulse [animation-delay:1s]" />

      <Card className="relative w-full max-w-sm border-border/60 shadow-xl backdrop-blur animate-in fade-in zoom-in-95 duration-500">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-lg shadow-indigo-500/30">
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Criar conta</CardTitle>
          <CardDescription>Cadastre-se no Ponto+ para começar a registrar seu ponto</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" name="name" placeholder="Seu nome" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="voce@empresa.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" placeholder="Mínimo 6 caracteres" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" required minLength={6} />
            </div>

            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
