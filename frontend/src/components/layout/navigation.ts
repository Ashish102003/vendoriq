import {
  LayoutDashboard,
  Building2,
  Layers,
  BarChart3,
  ShoppingCart,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  PieChart,
  Shield,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  shortcut?: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Analytics', path: '/analytics', icon: PieChart },
      { label: 'Risk Center', path: '/vendor-risk', icon: Shield },
    ],
  },
  {
    title: 'Vendor Management',
    items: [
      { label: 'Vendors', path: '/vendors', icon: Building2 },
      { label: 'Vendor Performance', path: '/vendor-performance', icon: BarChart3 },
      { label: 'Vendor Categories', path: '/vendor-categories', icon: Layers },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { label: 'Contracts', path: '/contracts', icon: FileText },
      { label: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
    ],
  },
  {
    title: 'Performance Data',
    items: [
      { label: 'Quality Evaluations', path: '/quality-evaluations', icon: ClipboardCheck },
      { label: 'Incidents', path: '/incidents', icon: AlertTriangle },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'AI Insights', path: '/ai-insights', icon: Sparkles },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
]