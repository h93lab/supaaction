import { Activity } from "lucide-react"

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background"><Activity className="size-4" /></div>{!compact && <span className="text-base font-semibold tracking-tight">SupaAction</span>}</div>
}
