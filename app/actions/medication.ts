"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function listMedications(profileId:string){
  const s=getSession(); if(!s) return [];
  const p=await prisma.profile.findFirst({where:{id:profileId,familyId:s.familyId}});
  if(!p) return [];
  return prisma.medication.findMany({where:{profileId},orderBy:{timeOfDay:"asc"}});
}
export async function addMedication(profileId:string,name:string,dosage:string,timeOfDay:string){
  const s=getSession(); if(!s) return {ok:false as const,error:"Unauthorized"};
  const p=await prisma.profile.findFirst({where:{id:profileId,familyId:s.familyId}});
  if(!p) return {ok:false as const,error:"Profile not found"};
  const m=await prisma.medication.create({data:{profileId,name,dosage,timeOfDay}});
  return {ok:true as const,id:m.id};
}
export async function markMedicationTaken(id:string,takenToday:boolean){
  const s=getSession(); if(!s) return {ok:false as const,error:"Unauthorized"};
  await prisma.medication.update({where:{id},data:{takenToday}});
  return {ok:true as const};
}
