"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { loginAction, type ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedBrazilianFlag } from "@/components/animated-flag";

const initialState: ActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-emerald-50 px-4 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl animate-pulse [animation-delay:1s]" />

      <Card className="relative w-full max-w-sm border-border/60 shadow-xl backdrop-blur animate-in fade-in zoom-in-95 duration-500">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-lg shadow-indigo-500/30">
            <Clock className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Ponto+</CardTitle>
          <CardDescription>Controle de ponto e banco de horas</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="voce@empresa.com" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required />
            </div>

            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link href="/cadastro" className="font-medium text-primary hover:underline">
              Cadastrar
            </Link>
          </p>

          <div className="mt-6 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Contas de demonstração</p>
            <p className="mt-1">colaborador@empresa.com / senha123</p>
          </div>
        </CardContent>
      </Card>

      <Link href="/" className="sr-only">
        Início
      </Link>

      {/* Assinatura do autor com flag animada. `pointer-events-none` para nao capturar clique
          sobre o cartao em telas baixas, onde os dois se aproximam. */}
      <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-2">
        <div className="h-6 w-8 overflow-hidden rounded opacity-80 hover:opacity-100 transition-opacity">
          <AnimatedBrazilianFlag />
        </div>
        <p className="font-mono text-[11px] tracking-wide text-muted-foreground/70">
          feita por @lucascasotti
        </p>
      </div>
    </div>
  );
}
