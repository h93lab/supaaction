import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return <div className="space-y-6"><div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-80 max-w-full" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)}</div><Skeleton className="h-96" /></div>
}
