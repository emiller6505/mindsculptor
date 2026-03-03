'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type DataPoint = { window_end: string; win_rate: number }

export function WinRateOverTime({
  hasMatches,
  data,
}: {
  hasMatches: boolean
  data: DataPoint[]
}) {
  if (!hasMatches || data.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-ash">
          Win rate data will appear as match records are ingested
        </p>
      </div>
    )
  }

  // Future: render actual win rate chart when match data exists
  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
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
          <Tooltip />
          <Line
            type="monotone"
            dataKey="win_rate"
            stroke="#C9A050"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
