import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartGrid, chartAxisTick, chartAxisLine, chartTooltipStyle, chartCursor } from './chartTheme'

export interface TrendSeries {
  key: string
  label: string
  color: string
}

interface TrendChartProps {
  data: Record<string, string | number | null>[]
  series: TrendSeries[]
  height?: number
  xDataKey?: string
  yDomain?: [number | 'auto', number | 'auto']
  valueFormatter?: (value: number) => string
}

export function TrendChart({
  data,
  series,
  height = 240,
  xDataKey = 'period',
  yDomain,
  valueFormatter,
}: TrendChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
          <XAxis
            dataKey={xDataKey}
            tick={{ fontSize: 11, fill: chartAxisTick }}
            tickLine={false}
            axisLine={{ stroke: chartAxisLine }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 11, fill: chartAxisTick }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={chartCursor}
            formatter={(value, name) => {
              if (value === null || value === undefined) return ['—', String(name)]
              return [valueFormatter ? valueFormatter(Number(value)) : value, String(name)]
            }}
            contentStyle={chartTooltipStyle}
          />
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}