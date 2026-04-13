import type { CampaignEventType, RecipientStatus } from '../types/database'

// Rate formatting with division-by-zero guard (per D-02 and CONTEXT.md Specifics)
export function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '\u2014' // em dash
  const rate = (numerator / denominator) * 100
  return `${rate.toFixed(1)}%`
}

// Rate with raw count for stat cards: "24.5% (124 opens)" (per CONTEXT.md Specifics)
export function formatRateWithCount(numerator: number, denominator: number, label: string): string {
  if (denominator === 0) return '\u2014'
  const rate = (numerator / denominator) * 100
  return `${rate.toFixed(1)}% (${numerator.toLocaleString()} ${label})`
}

export function getRateValue(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

// Relative timestamp using Intl.RelativeTimeFormat (per RESEARCH.md)
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (seconds < 60) return rtf.format(-seconds, 'second')
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour')
  return rtf.format(-Math.floor(seconds / 86400), 'day')
}

// Event type icon names (Lucide) — per UI-SPEC.md Event Type Icon Map
export const EVENT_ICON_MAP: Record<CampaignEventType, string> = {
  sent: 'Send',
  delivered: 'Mail',
  opened: 'Eye',
  clicked: 'MousePointer',
  replied: 'Reply',
  bounced: 'AlertTriangle',
  unsubscribed: 'UserMinus',
  complained: 'AlertTriangle',
}

// Event type colors — per UI-SPEC.md Color section
export const EVENT_COLOR_MAP: Record<CampaignEventType, string> = {
  sent: 'text-gray-400',
  delivered: 'text-gray-400',
  opened: 'text-green-400',
  clicked: 'text-indigo-400',
  replied: 'text-blue-400',
  bounced: 'text-red-400',
  unsubscribed: 'text-yellow-400',
  complained: 'text-orange-400',
}

// Event type display labels
export const EVENT_LABEL_MAP: Record<CampaignEventType, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  opened: 'Opened',
  clicked: 'Clicked',
  replied: 'Replied',
  bounced: 'Bounced',
  unsubscribed: 'Unsubscribed',
  complained: 'Complained',
}

// Recipient status to Badge variant mapping — per UI-SPEC.md Color section
export const STATUS_BADGE_VARIANT: Record<RecipientStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'default',
  queued: 'default',
  sent: 'default',
  delivered: 'default',
  opened: 'success',
  clicked: 'info',
  replied: 'info',
  bounced: 'danger',
  unsubscribed: 'warning',
  failed: 'default',
}

export const PAGE_SIZE = 50
