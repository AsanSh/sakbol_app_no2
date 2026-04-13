"use client";

import { useTransition } from "react";
import { activatePremiumStub } from "@/app/actions/premium";

export function PaywallModal({open,onClose,onActivated}:{open:boolean;onClose:()=>void;onActivated:()=>void}){
  const [pending,start]=useTransition();
  if(!open) return null;
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-emerald-950/50 p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-5">
      <h3 className="text-lg font-semibold text-emerald-950">Premium</h3>
      <p className="mt-2 text-sm text-emerald-900/80">Бесплатно: 3 анализа и 1 профиль. Premium: безлимит + Family Access.</p>
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm">Жабуу</button>
        <button disabled={pending} onClick={()=>start(async()=>{const r=await activatePremiumStub("MBANK"); if(r.ok){onActivated(); onClose();}})} className="rounded-xl bg-emerald-900 px-4 py-2 text-sm text-mint">{pending?"Оплата...":"Оплатить MBANK/MegaPay"}</button>
      </div>
    </div>
  </div>;
}
