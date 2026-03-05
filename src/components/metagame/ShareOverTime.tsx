'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useState } from 'react'

type DataPoint = { window_end: string; meta_share: number }

const RANGES = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: Infinity },
] as const

function filterByRange(data: DataPoint[], days: number): DataPoint[] {
  if (days === Infinity) return data
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return data.filter(d => d.window_end >= cutoffStr)
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-edge rounded-lg px-3 py-2 text-xs">
      <span className="text-ink font-medium">{payload[0].value.toFixed(1)}%</span>
    </div>
  )
}

export function ShareOverTime({ data }: { data: DataPoint[] }) {
  const [range, setRange] = useState<number>(Infinity)
  const filtered = filterByRange(data, range)

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-ash italic py-8 text-center">
        No meta share history yet — data accumulates with each event
      </p>
    )
  }

  const fewPoints = filtered.length < 3

  return (
    <div className="space-y-3">
      {/* Range toggle */}
      <div className="flex items-center gap-2">
        {RANGES.map(r => (
          <button
            key={r.label}
            onClick={() => setRange(r.days)}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              range === r.days
                ? 'bg-spark/10 text-spark border border-spark/20'
                : 'text-ash hover:text-ink border border-edge'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {fewPoints ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="flex items-baseline gap-6">
            {filtered.map(d => (
              <div key={d.window_end} className="text-center">
                <span className="text-2xl font-bold text-ink text-glow">{d.meta_share.toFixed(1)}%</span>
                <p className="text-xs text-ash mt-1">{d.window_end}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-ash italic">
            Chart appears after a few more events
          </p>
        </div>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={filtered} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="shareGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F8EF7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4F8EF7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="window_end"
                tick={{ fill: '#4A5878', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#4A5878', fontSize: 11 }}
                tickFormatter={v => `${v}%`}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="meta_share"
                stroke="#4F8EF7"
                fill="url(#shareGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
