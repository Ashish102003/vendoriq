import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { SEVERITY_COLORS, chartTooltipStyle } from './chartTheme'
import { INCIDENT_SEVERITY_LABELS } from '../../utils/permissions'
import type { IncidentSeverity } from '../../types'

interface SeverityPieChartProps {
  data: { severity: IncidentSeverity; count: number; percentage: number }[]
}

export function SeverityPieChart({ data }: SeverityPieChartProps) {
  const chartData = data.filter((item) => item.count > 0)

  return (
    <div>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="severity"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              stroke="transparent"
            >
              {chartData.map((entry) => (
                <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [value, INCIDENT_SEVERITY_LABELS[name as IncidentSeverity] ?? name]}
              contentStyle={chartTooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map((item) => (
          <div key={item.severity} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SEVERITY_COLORS[item.severity] }}
            />
            <span className="text-xs text-slate-400">
              {INCIDENT_SEVERITY_LABELS[item.severity]}
            </span>
            <span className="ml-auto text-xs font-medium tabular-nums text-slate-300">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}