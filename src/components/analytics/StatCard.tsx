import type { LucideIcon } from 'lucide-react'
import { Card } from '../ui/Card'

interface StatCardProps {
  label: string
  value: string
  subLabel?: string
  icon: LucideIcon
  iconColor: string
}

export function StatCard({ label, value, subLabel, icon: Icon, iconColor }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-2xl font-semibold text-gray-100 mt-0.5">{value}</p>
        {subLabel && <p className="text-xs text-gray-400">{subLabel}</p>}
      </div>
    </Card>
  )
}
