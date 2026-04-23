import "server-only";

const INVISIBLE = /[\u200B-\u200D\uFEFF]/g;

/**
 * Ссылка / @username / числовой id (приват с ботом после Start).
 * Username — к нижнему регистру, t.me/… извлекается.
 */
export function parseTelegramChatRef(raw: string): { ok: true; ref: string } | { ok: false; error: string } {
  if (!raw?.trim()) {
    return { ok: false, error: "Пустой ввод" };
  }

  let s = raw.replace(INVISIBLE, "").trim();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[\(（\)）\[\]【】]/g, " ").replace(/\s+/g, " ").trim();

  const urlM =
    s.match(/(?:https?:)?\/\/(?:t(?:elegram)?)\.me\/([A-Za-z0-9_+]+)(?:[/?#].*)?$/i) ||
    s.match(/^(?:t(?:elegram)?)\.me\/([A-Za-z0-9_+]+)(?:[/?#].*)?$/i);
  if (urlM) {
    const seg = urlM[1].replace(/\+$/, "");
    if (/^\d{1,20}$/.test(seg)) {
      return { ok: true, ref: seg };
    }
    if (seg && /^[A-Za-z0-9_]/.test(seg)) {
      return { ok: true, ref: (seg.startsWith("@") ? seg : `@${seg}`).toLowerCase() };
    }
  }

  s = s.replace(/\s/g, "");
  s = s.replace(INVISIBLE, "");

  if (!s) {
    return { ok: false, error: "Пустой ввод" };
  }

  if (/^\d{1,20}$/.test(s)) {
    return { ok: true, ref: s };
  }
  if (/^-100\d{8,14}$/.test(s)) {
    return { ok: true, ref: s };
  }

  const u = s.startsWith("@") ? s.slice(1) : s;
  if (u && /^[A-Za-z0-9_]{4,32}$/i.test(u)) {
    return { ok: true, ref: `@${u}`.toLowerCase() };
  }

  return { ok: false, error: "Не похоже на @username, id или t.me-ссылку" };
}

/**
 * Телефон, а не chat id. 5–10 «голых» цифр — часто id Telegram → false.
 */
export function stringLooksMostlyLikePhone(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length < 9) return false;
  if (d.length === 9 && /^[5-7]\d{8}$/.test(d)) return true;
  if (d.length === 10 && d.startsWith("0")) return true;
  if (d.length === 12 && d.startsWith("996")) return true;
  if (d.length >= 11) return true;
  if (d.length === 10 && /^\d{10}$/.test(d) && (raw.includes("+") || /\d\s+\d/.test(raw))) {
    return true;
  }
  if (d.length === 10 && d.startsWith("996")) return true;
  return false;
}
