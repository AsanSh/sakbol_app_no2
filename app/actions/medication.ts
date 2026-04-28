"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendTelegramDirectMessage } from "@/lib/telegram-send";

export async function listMedications(profileId:string){
  const s=await getSession(); if(!s) return [];
  const p=await prisma.profile.findFirst({where:{id:profileId,familyId:s.familyId}});
  if(!p) return [];
  return prisma.medication.findMany({where:{profileId},orderBy:{timeOfDay:"asc"}});
}
export async function addMedication(profileId:string,name:string,dosage:string,timeOfDay:string){
  const s=await getSession(); if(!s) return {ok:false as const,error:"Unauthorized"};
  const p=await prisma.profile.findFirst({where:{id:profileId,familyId:s.familyId}});
  if(!p) return {ok:false as const,error:"Profile not found"};
  const m=await prisma.medication.create({data:{profileId,name,dosage,timeOfDay}});
  return {ok:true as const,id:m.id};
}
export async function markMedicationTaken(id: string, takenToday: boolean) {
  const s = await getSession();
  if (!s) return { ok: false as const, error: "Unauthorized" };
  await prisma.medication.update({ where: { id }, data: { takenToday } });
  return { ok: true as const };
}

/** Напоминание в Telegram сейчас (нужен числовой telegramUserId у профиля). */
export async function sendMedicationTelegramReminder(medicationId: string) {
  const s = await getSession();
  if (!s) return { ok: false as const, error: "Unauthorized" };

  const med = await prisma.medication.findFirst({
    where: { id: medicationId, profile: { familyId: s.familyId } },
    include: { profile: { select: { displayName: true, telegramUserId: true } } },
  });
  if (!med) return { ok: false as const, error: "Not found" };

  const tid = med.profile.telegramUserId;
  if (!tid) {
    return { ok: false as const, error: "profile_no_telegram" };
  }

  const text = `SakBol: ${med.name} — ${med.dosage}, ${med.timeOfDay}. (${med.profile.displayName})`;
  const sent = await sendTelegramDirectMessage(tid, text);
  if (!sent.ok) return { ok: false as const, error: sent.error };
  return { ok: true as const };
}
