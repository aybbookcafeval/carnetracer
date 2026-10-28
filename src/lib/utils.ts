import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
  }
  return dp[a.length][b.length];
}

export function similarity(a: string, b: string): number {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (!s || !t) return 0;
  if (s === t) return 1;

  const sTokens = s.split(" ").filter(Boolean);
  const tTokens = t.split(" ").filter(Boolean);
  const [shorter, longer] = sTokens.length <= tTokens.length ? [sTokens, tTokens] : [tTokens, sTokens];
  if (shorter.length > 0 && shorter.every(tok => longer.includes(tok))) {
    return 0.9 + 0.1 * (shorter.length / longer.length);
  }

  const distance = levenshtein(s, t);
  return Math.max(0, 1 - distance / Math.max(s.length, t.length));
}
