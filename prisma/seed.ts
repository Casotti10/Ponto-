import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { subDays, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";

const prisma = new PrismaClient();

function at(date: Date, h: number, m: number) {
  return setMilliseconds(setSeconds(setMinutes(setHours(date, h), m), 0), 0);
}

async function main() {
  const passwordHash = await bcrypt.hash("senha123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@empresa.com" },
    update: {},
    create: {
      name: "Lucas",
      email: "admin@empresa.com",
      passwordHash,
      role: "ADMIN",
      avatarColor: "#6366f1",
    },
  });

  await prisma.workSchedule.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      dailyHours: 8,
      weeklyHours: 40,
      lunchBreakMinutes: 60,
      toleranceMinutes: 10,
      workDays: [1, 2, 3, 4, 5],
      entryTime: "08:00",
      lunchOutTime: "12:00",
      lunchReturnTime: "13:00",
      exitTime: "17:00",
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: "colaborador@empresa.com" },
    update: {},
    create: {
      name: "Ana Souza",
      email: "colaborador@empresa.com",
      passwordHash,
      role: "EMPLOYEE",
      avatarColor: "#22c55e",
    },
  });

  await prisma.workSchedule.upsert({
    where: { userId: demo.id },
    update: {},
    create: {
      userId: demo.id,
      dailyHours: 8,
      weeklyHours: 40,
      lunchBreakMinutes: 60,
      toleranceMinutes: 10,
      workDays: [1, 2, 3, 4, 5],
      entryTime: "08:00",
      lunchOutTime: "12:00",
      lunchReturnTime: "13:00",
      exitTime: "17:00",
    },
  });

  // Gera 45 dias de histórico de exemplo para o usuário demo
  const existingEntries = await prisma.timeEntry.count({ where: { userId: demo.id } });
  if (existingEntries === 0) {
    const today = new Date();
    for (let i = 45; i >= 1; i--) {
      const day = subDays(today, i);
      const weekday = day.getDay();
      if (weekday === 0 || weekday === 6) continue; // fim de semana

      const roll = Math.random();
      if (roll < 0.08) {
        // falta injustificada aleatória
        await prisma.absence.create({
          data: {
            userId: demo.id,
            date: at(day, 0, 0),
            type: "FALTA_INJUSTIFICADA",
            impact: "DESCONTA",
            reason: "Não compareceu",
          },
        });
        continue;
      }
      if (roll < 0.13) {
        await prisma.absence.create({
          data: {
            userId: demo.id,
            date: at(day, 0, 0),
            type: "HOME_OFFICE",
            impact: "NEUTRO",
            reason: "Trabalho remoto",
          },
        });
      }

      const entradaVariacao = Math.floor(Math.random() * 15) - 5;
      const saidaVariacao = Math.floor(Math.random() * 40) - 5;

      await prisma.timeEntry.createMany({
        data: [
          { userId: demo.id, date: at(day, 0, 0), type: "ENTRADA", time: at(day, 8, Math.max(0, entradaVariacao)) },
          { userId: demo.id, date: at(day, 0, 0), type: "SAIDA_ALMOCO", time: at(day, 12, 0) },
          { userId: demo.id, date: at(day, 0, 0), type: "RETORNO_ALMOCO", time: at(day, 13, 0) },
          { userId: demo.id, date: at(day, 0, 0), type: "SAIDA", time: at(day, 17, Math.max(0, saidaVariacao)) },
        ],
      });
    }

    await prisma.absence.create({
      data: {
        userId: demo.id,
        date: at(subDays(today, 60), 0, 0),
        endDate: at(subDays(today, 56), 0, 0),
        type: "FERIAS",
        impact: "NEUTRO",
        reason: "Férias anuais",
      },
    });

    await prisma.balanceAdjustment.create({
      data: {
        userId: demo.id,
        minutes: 120,
        type: "MANUAL_ADD",
        reason: "Ajuste inicial de saldo migrado do sistema antigo",
      },
    });

    await prisma.goal.create({
      data: {
        userId: demo.id,
        title: "Meta de horas do mês",
        targetHours: 160,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      },
    });
  }

  console.log("Seed concluído.");
  console.log("Login admin: admin@empresa.com / senha123");
  console.log("Login colaborador: colaborador@empresa.com / senha123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
