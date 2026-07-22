import { Settings, Clock, Target, UserCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrCreateWorkSchedule } from "@/lib/time-service";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WorkScheduleForm } from "@/components/settings/work-schedule-form";
import { GoalsManager } from "@/components/settings/goals-manager";
import { ProfileFormDialog } from "@/components/settings/profile-form-dialog";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  EMPLOYEE: "Colaborador",
};

export default async function ConfiguracoesPage() {
  const user = await requireUser();
  const now = new Date();
  const [schedule, goals] = await Promise.all([
    getOrCreateWorkSchedule(user.id),
    prisma.goal.findMany({ where: { userId: user.id }, orderBy: [{ year: "desc" }, { month: "desc" }] }),
  ]);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings className="h-6 w-6" /> Configurações
        </h1>
        <p className="text-muted-foreground">Gerencie sua jornada de trabalho, metas e perfil.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" /> Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback style={{ backgroundColor: user.avatarColor, color: "white" }} className="text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[user.role] ?? user.role}</p>
            </div>
          </div>
          <ProfileFormDialog name={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Jornada de trabalho
          </CardTitle>
          <CardDescription>
            Essas configurações são usadas no cálculo automático de horas extras, horas negativas e banco de horas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkScheduleForm
            schedule={{
              dailyHours: schedule.dailyHours,
              weeklyHours: schedule.weeklyHours,
              lunchBreakMinutes: schedule.lunchBreakMinutes,
              toleranceMinutes: schedule.toleranceMinutes,
              workDays: schedule.workDays,
              entryTime: schedule.entryTime,
              lunchOutTime: schedule.lunchOutTime,
              lunchReturnTime: schedule.lunchReturnTime,
              exitTime: schedule.exitTime,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" /> Metas de horas
          </CardTitle>
          <CardDescription>Defina metas mensais de horas trabalhadas, acompanhadas no dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoalsManager
            goals={goals.map((g) => ({ id: g.id, title: g.title, targetHours: g.targetHours, year: g.year, month: g.month }))}
          />
        </CardContent>
      </Card>

      <p className="pb-6 text-center text-xs text-muted-foreground">
        Ponto+ · Sistema de Controle de Ponto e Banco de Horas · {now.getFullYear()}
      </p>
    </div>
  );
}
