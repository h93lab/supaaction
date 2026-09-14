import { PageHeading } from "@/components/page-heading"
import { SettingsForm } from "@/components/settings-form"
import { getSettings } from "@/lib/db"

export const dynamic = "force-dynamic"

export default function SettingsPage() {
  return <div className="mx-auto max-w-[1200px]"><PageHeading title="الإعدادات" description="تحكم في توقيت التنشيط وإعادة المحاولة والمزامنة التلقائية." /><SettingsForm initial={getSettings()} /></div>
}
