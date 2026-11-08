const PHONE = /^\+?[\d\s().-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?$/;
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

export function cleanPhone(value: string): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || text.length > 32 || !PHONE.test(text)) return null;
  if ((text.match(/\+/g) ?? []).length > 1 || (text.includes("+") && !text.startsWith("+"))) {
    return null;
  }
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return text;
}

export function cleanEmail(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (text.length > 320 || !EMAIL.test(text)) return null;
  return text;
}

export function cleanWebsite(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.length > 300 || /\s/.test(raw)) return null;
  const text = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  let host = text.split("://")[1]?.split("/")[0]?.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  if (host.startsWith("www.")) host = host.slice(4);
  if (!host || !HOST.test(host)) return null;
  return text;
}

/** True when the field is empty or only the auto-inserted @. */
export function isBlankInstagram(value: string): boolean {
  const text = value.trim();
  if (!text || text === "@") return true;
  const handle = text.replace(/^@+/, "").trim();
  return !handle && !/instagram\.com/i.test(text);
}

/** Always show a handle with @ so it reads as Instagram. */
export function formatInstagram(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return cleanInstagram(value) ?? (value.trim().startsWith("@") ? value.trim() : `@${value.trim()}`);
}

export function instagramProfileUrl(value: string | null | undefined): string | null {
  const handle = formatInstagram(value).replace(/^@/, "");
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}

export function cleanInstagram(value: string): string | null {
  let text = value.trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  const prefixes = [
    "https://www.instagram.com/",
    "http://www.instagram.com/",
    "https://instagram.com/",
    "http://instagram.com/",
    "www.instagram.com/",
    "instagram.com/",
  ];
  for (const prefix of prefixes) {
    if (lowered.startsWith(prefix)) {
      text = text.slice(prefix.length);
      break;
    }
  }
  let handle = text.replace(/^@/, "").split("?")[0]?.split("/")[0]?.trim() ?? "";
  if (!HANDLE.test(handle)) return null;
  return `@${handle}`;
}

export function parseCoordinate(value: string): number {
  const text = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return Number.NaN;
  return Number(text);
}
