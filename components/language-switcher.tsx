"use client";

import { useLanguage } from "@/context/language-context";

export function LanguageSwitcher(){
  const {lang,setLang}=useLanguage();
  return (
    <div className="flex items-center gap-1 rounded-full border border-emerald-900/20 bg-white px-1 py-1 text-xs">
      <button onClick={()=>setLang("ru")} className={`rounded-full px-2 py-1 ${lang==="ru"?"bg-emerald-900 text-mint":"text-emerald-900"}`}>RU</button>
      <button onClick={()=>setLang("kg")} className={`rounded-full px-2 py-1 ${lang==="kg"?"bg-emerald-900 text-mint":"text-emerald-900"}`}>KG</button>
    </div>
  );
}
