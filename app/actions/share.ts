"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function createShareToken(healthRecordId: string){
  const s=await getSession();
  if(!s) return {ok:false as const,error:"Unauthorized"};
  const rec=await prisma.healthRecord.findFirst({where:{id:healthRecordId, profile:{familyId:s.familyId}}});
  if(!rec) return {ok:false as const,error:"Record not found"};
  const token=randomUUID().replace(/-/g,"");
  await prisma.shareToken.create({
    data: {
      token,
      healthRecordId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  return {ok:true as const, token};
}
