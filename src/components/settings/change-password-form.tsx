"use client";

import { useActionState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { changePassword, type ChangePasswordState } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";

const initialState: ChangePasswordState = {};

const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", regex: /.{8,}/ },
  { label: "Máximo 72 caracteres", regex: /^.{0,72}$/ },
  { label: "Letra minúscula", regex: /[a-z]/ },
  { label: "Letra maiúscula", regex: /[A-Z]/ },
  { label: "Número", regex: /[0-9]/ },
  { label: "Caractere especial", regex: /[^A-Za-z0-9]/ },
];

/**
 * Formulário para alteração de senha
 *
 * Validações:
 * - Senha atual deve ser correta
 * - Nova senha deve atender requisitos NIST SP 800-63B
 * - Confirmação deve ser igual
 * - Nova senha não pode ser igual à anterior
 */
export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePassword, initialState);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Verificar requisitos da senha em tempo real
  const passwordMeetsRequirement = (password: string, regex: RegExp) => {
    return regex.test(password);
  };

  const allRequirementsMet =
    newPassword.length >= 8 &&
    PASSWORD_RULES.every((rule) => passwordMeetsRequirement(newPassword, rule.regex));

  return (
    <form action={formAction} className="space-y-6">
      {/* Erro */}
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Sucesso */}
      {state.success && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <AlertDescription>✅ Senha alterada com sucesso!</AlertDescription>
        </Alert>
      )}

      {/* Senha Atual */}
      <div className="space-y-2">
        <Label htmlFor="currentPassword" className="flex items-center gap-2">
          <Lock className="h-4 w-4" /> Senha Atual
        </Label>
        <div className="relative">
          <Input
            id="currentPassword"
            name="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            placeholder="Digite sua senha atual"
            required
            disabled={isPending}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Para confirmar sua identidade, informe sua senha atual</p>
      </div>

      {/* Nova Senha */}
      <div className="space-y-2">
        <Label htmlFor="newPassword" className="flex items-center gap-2">
          <Lock className="h-4 w-4" /> Nova Senha
        </Label>
        <div className="relative">
          <Input
            id="newPassword"
            name="newPassword"
            type={showNewPassword ? "text" : "password"}
            placeholder="Digite sua nova senha"
            required
            disabled={isPending}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Requisitos da Senha */}
        {newPassword && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Requisitos:</p>
            <div className="space-y-1">
              {PASSWORD_RULES.map((rule) => {
                const meets = passwordMeetsRequirement(newPassword, rule.regex);
                return (
                  <div key={rule.label} className="flex items-center gap-2 text-xs">
                    <span className={`h-4 w-4 rounded flex items-center justify-center ${meets ? "bg-green-500" : "bg-gray-300"}`}>
                      {meets && <span className="text-white text-xs">✓</span>}
                    </span>
                    <span className={meets ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>
                      {rule.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmar Nova Senha */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="flex items-center gap-2">
          <Lock className="h-4 w-4" /> Confirmar Nova Senha
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Digite sua nova senha novamente"
            required
            disabled={isPending}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Deve ser igual à nova senha acima</p>
      </div>

      {/* Barra de Força */}
      {newPassword && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Força da senha:</p>
            <span
              className={`text-xs font-semibold ${
                allRequirementsMet
                  ? "text-green-600 dark:text-green-400"
                  : "text-yellow-600 dark:text-yellow-400"
              }`}
            >
              {allRequirementsMet ? "✅ Forte" : "⚠️ Fraca"}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full transition-all ${
                allRequirementsMet
                  ? "w-full bg-green-500"
                  : newPassword.length > 0
                    ? "w-1/2 bg-yellow-500"
                    : "w-0"
              }`}
            />
          </div>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isPending || !allRequirementsMet} className="flex-1">
          {isPending ? "Alterando..." : "Alterar Senha"}
        </Button>
        <Button
          type="reset"
          variant="outline"
          disabled={isPending}
          onClick={() => setNewPassword("")}
        >
          Limpar
        </Button>
      </div>

      {/* Dicas de Segurança */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
        <p className="text-xs font-medium text-yellow-900 dark:text-yellow-200">💡 Dicas de Segurança</p>
        <ul className="mt-2 space-y-1 text-xs text-yellow-800 dark:text-yellow-300">
          <li>✓ Use uma senha única (não use em outros sites)</li>
          <li>✓ Não compartilhe sua senha com ninguém</li>
          <li>✓ Use uma combinação de letras, números e símbolos</li>
          <li>✓ Altere sua senha periodicamente (a cada 3-6 meses)</li>
        </ul>
      </div>
    </form>
  );
}
