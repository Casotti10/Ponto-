"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { UserPlus, Check, X } from "lucide-react";
import { registerAction } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ActionState = {};

/**
 * Espelha `strongPasswordSchema` de src/lib/validations.ts.
 *
 * Esta lista existe só para dar retorno enquanto a pessoa digita — quem decide
 * de fato é o servidor, na Server Action. Ao mexer numa regra lá, ajuste aqui
 * também, senão a tela promete uma coisa e o cadastro recusa outra.
 */
const PASSWORD_RULES = [
  { label: "Pelo menos 8 caracteres", test: (v: string) => v.length >= 8 },
  { label: "Uma letra minúscula", test: (v: string) => /[a-z]/.test(v) },
  { label: "Uma letra maiúscula", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Um número", test: (v: string) => /[0-9]/.test(v) },
  { label: "Um caractere especial", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export default function CadastroPage() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [password, setPassword] = useState("");
  const atendidas = PASSWORD_RULES.filter((r) => r.test(password)).length;

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
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Crie uma senha forte"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-rules"
              />

              {/* A barra e a lista aparecem só depois da primeira tecla: mostrar
                  cinco itens vermelhos num campo intocado acusa o usuário de um
                  erro que ele ainda não cometeu. */}
              {password.length > 0 && (
                <div id="password-rules" className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1">
                  <div className="flex gap-1" aria-hidden="true">
                    {PASSWORD_RULES.map((_, i) => (
                      <span
                        key={i}
                        className={
                          "h-1 flex-1 rounded-full transition-colors " +
                          (i < atendidas
                            ? atendidas === PASSWORD_RULES.length
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                            : "bg-muted")
                        }
                      />
                    ))}
                  </div>
                  <ul className="space-y-1">
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <li
                          key={rule.label}
                          className={
                            "flex items-center gap-1.5 text-xs " +
                            (ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")
                          }
                        >
                          {ok ? (
                            <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                          ) : (
                            <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                          )}
                          <span>{rule.label}</span>
                          <span className="sr-only">{ok ? "— atendido" : "— pendente"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Repita a senha" required minLength={8} maxLength={72} />
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
