export function formatDate(value: string | null, timeZone = "Africa/Cairo") {
  if (!value) return "لم يعمل بعد"
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value))
}

export function shortRef(ref: string) {
  return ref.length > 16 ? `${ref.slice(0, 8)}…${ref.slice(-5)}` : ref
}
