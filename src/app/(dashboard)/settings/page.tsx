import { PageHeading } from "@/components/page-heading"
import { SettingsForm } from "@/components/settings-form"
import { getSettings } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <div className="mx-auto max-w-[1200px]"><PageHeading title="الإعدادات" description="تحكم في توقيت التنشيط وإعادة المحاولة والمزامنة التلقائية، وغيّر كلمة مرور لوحة التحكم." /><SettingsForm initial={getSettings()} initialTab={tab === "security" ? "security" : "schedule"} /></div>
}
