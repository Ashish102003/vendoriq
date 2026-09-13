import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TREND_COLORS, chartGrid, chartAxisTick, chartAxisLine, chartTooltipStyle } from './chartTheme'
import type { VendorComparisonMetric } from '../../types'

interface ComparisonChartProps {
  vendors: VendorComparisonMetric[]
}

export function ComparisonChart({ vendors }: ComparisonChartProps) {
  const data = vendors.map((vendor) => ({
    vendor: vendor.vendor_name,
    Overall: vendor.overall_score,
    Delivery: vendor.delivery_score,
    Quality: vendor.quality_score,
    Incidents: vendor.incident_score,
  }))

  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
          <XAxis
            dataKey="vendor"
            tick={{ fontSize: 11, fill: chartAxisTick }}
            tickLine={false}
            axisLine={{ stroke: chartAxisLine }}
            interval={0}
            angle={-18}
            textAnchor="end"
            height={46}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: chartAxisTick }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} contentStyle={chartTooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
          <Bar dataKey="Overall" fill={TREND_COLORS.comparisonOverall} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Delivery" fill={TREND_COLORS.comparisonDelivery} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Quality" fill={TREND_COLORS.comparisonQuality} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Incidents" fill={TREND_COLORS.comparisonIncident} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}