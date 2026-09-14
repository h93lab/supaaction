import { AccountsGrid } from "@/components/accounts-grid"
import { AddAccountDialog } from "@/components/add-account-dialog"
import { PageHeading } from "@/components/page-heading"
import { listAccounts } from "@/lib/db"

export const dynamic = "force-dynamic"

export default function AccountsPage() {
  return <div className="mx-auto max-w-[1500px]"><PageHeading title="الحسابات" description="اربط حسابات Supabase وسيتم اكتشاف مشاريعها ومزامنتها تلقائيًا." actions={<AddAccountDialog />} /><AccountsGrid accounts={listAccounts()} /></div>
}
