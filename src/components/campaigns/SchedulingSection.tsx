import { TIMEZONES } from '../../lib/constants'

interface SchedulingSectionProps {
  scheduleMode: 'now' | 'later'
  onScheduleModeChange: (mode: 'now' | 'later') => void
  scheduledAt: string
  onScheduledAtChange: (value: string) => void
  timezone: string
  onTimezoneChange: (value: string) => void
  error?: string
}

export function SchedulingSection({
  scheduleMode,
  onScheduleModeChange,
  scheduledAt,
  onScheduledAtChange,
  timezone,
  onTimezoneChange,
  error,
}: SchedulingSectionProps) {
  // Minimum datetime: current time formatted for datetime-local input
  const now = new Date()
  const minDatetime = now.toISOString().slice(0, 16)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Delivery
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="scheduleMode"
            value="now"
            checked={scheduleMode === 'now'}
            onChange={() => onScheduleModeChange('now')}
            className="mt-1 accent-indigo-500"
          />
          <div>
            <span className="text-sm text-gray-200">Send immediately</span>
            <p className="text-xs text-gray-400">
              Campaign will be queued and sent right away.
            </p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="scheduleMode"
            value="later"
            checked={scheduleMode === 'later'}
            onChange={() => onScheduleModeChange('later')}
            className="mt-1 accent-indigo-500"
          />
          <span className="text-sm text-gray-200">Schedule for later</span>
        </label>
        {scheduleMode === 'later' && (
          <div className="flex flex-col gap-3 mt-3 pl-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">
                Send date and time
              </label>
              <input
                type="datetime-local"
                min={minDatetime}
                value={scheduledAt}
                onChange={(e) => onScheduledAtChange(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {error && (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => onTimezoneChange(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
