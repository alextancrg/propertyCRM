export function formatMYR(value: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? 2;
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return new Intl.DateTimeFormat("en-MY", { month: "short", year: "numeric" }).format(d);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
