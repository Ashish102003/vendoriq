export interface HealthStatus {
  status: string
  application: string
}

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
}

export interface ApiError {
  detail?: string
  status?: number
}

export interface AuthUser {
  id: number
  first_name: string
  last_name: string
  email: string
  role: {
    id: number
    name: string
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: {
    id: number
    first_name: string
    last_name: string
    email: string
    role: string
  }
}

export type VendorStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'UNDER_REVIEW'
  | 'SUSPENDED'
  | 'TERMINATED'

export interface VendorCategorySummary {
  id: number
  name: string
}

export interface VendorListItem {
  id: number
  vendor_code: string
  company_name: string
  contact_person: string | null
  email: string | null
  category: VendorCategorySummary
  status: VendorStatus
  is_active: boolean
  vendor_since: string | null
  created_at: string
}

export interface VendorDetail extends VendorListItem {
  phone: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
  updated_at: string
}

export interface PaginatedVendors {
  items: VendorListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface VendorStatistics {
  total_vendors: number
  active_vendors: number
  pending_vendors: number
  under_review_vendors: number
  suspended_vendors: number
  terminated_vendors: number
  inactive_vendors: number
}

export interface VendorPayload {
  vendor_code: string
  company_name: string
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  website?: string | null
  category_id: number
  status?: VendorStatus
  vendor_since?: string | null
  is_active?: boolean
}

export type VendorUpdatePayload = Partial<VendorPayload>

export interface VendorStatusUpdatePayload {
  status: VendorStatus
  is_active?: boolean
}

export type VendorSortField =
  | 'company_name'
  | 'vendor_code'
  | 'status'
  | 'created_at'
  | 'updated_at'

export interface VendorQuery {
  page?: number
  page_size?: number
  search?: string
  category_id?: number
  status?: VendorStatus
  is_active?: boolean
  sort_by?: VendorSortField
  sort_order?: 'asc' | 'desc'
}

export interface VendorCategory {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VendorCategoryWithCount extends VendorCategory {
  vendor_count: number
}

export interface VendorCategoryPayload {
  name: string
  description?: string | null
  is_active?: boolean
}

export type VendorCategoryUpdatePayload = Partial<VendorCategoryPayload>

export type ContractStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'EXPIRED'

export interface ContractVendorSummary {
  id: number
  vendor_code: string
  company_name: string
}

export interface ContractListItem {
  id: number
  contract_number: string
  title: string
  vendor: ContractVendorSummary
  contract_value: string
  start_date: string
  end_date: string
  status: ContractStatus
  is_active: boolean
  created_at: string
}

export interface ContractDetail extends ContractListItem {
  vendor_id: number
  description: string | null
  updated_at: string
}

export interface PaginatedContracts {
  items: ContractListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ContractStatistics {
  total_contracts: number
  active_contracts: number
  draft_contracts: number
  completed_contracts: number
  on_hold_contracts: number
  cancelled_contracts: number
  expired_contracts: number
  total_contract_value: string
}

export interface ContractPayload {
  vendor_id: number
  contract_number: string
  title: string
  description?: string | null
  contract_value: number | string
  start_date: string
  end_date: string
  status?: ContractStatus
  is_active?: boolean
}

export type ContractUpdatePayload = Partial<ContractPayload>

export interface ContractStatusUpdatePayload {
  status: ContractStatus
}

export type ContractSortField =
  | 'contract_number'
  | 'title'
  | 'contract_value'
  | 'start_date'
  | 'end_date'
  | 'status'
  | 'created_at'
  | 'updated_at'

export interface ContractQuery {
  page?: number
  page_size?: number
  search?: string
  vendor_id?: number
  status?: ContractStatus
  is_active?: boolean
  sort_by?: ContractSortField
  sort_order?: 'asc' | 'desc'
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'CANCELLED'
  | 'CLOSED'

export type DeliveryStatus = 'PENDING' | 'ON_TIME' | 'DELAYED'

export interface PurchaseOrderVendorSummary {
  id: number
  vendor_code: string
  company_name: string
}

export interface PurchaseOrderContractSummary {
  id: number
  contract_number: string
  title: string
}

export interface PurchaseOrderListItem {
  id: number
  order_number: string
  title: string
  vendor: PurchaseOrderVendorSummary
  contract: PurchaseOrderContractSummary | null
  order_value: string
  order_date: string
  expected_delivery_date: string
  actual_delivery_date: string | null
  delivery_status: DeliveryStatus
  delay_days: number | null
  status: PurchaseOrderStatus
  created_at: string
}

export interface PurchaseOrderDetail extends PurchaseOrderListItem {
  vendor_id: number
  contract_id: number | null
  description: string | null
  updated_at: string
}

export interface PaginatedPurchaseOrders {
  items: PurchaseOrderListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PurchaseOrderStatistics {
  total_orders: number
  draft_orders: number
  issued_orders: number
  in_progress_orders: number
  delivered_orders: number
  partially_delivered_orders: number
  cancelled_orders: number
  closed_orders: number
  total_order_value: string
  on_time_deliveries: number
  delayed_deliveries: number
  pending_deliveries: number
}

export interface VendorOperationsSummary {
  vendor_id: number
  total_contracts: number
  active_contracts: number
  total_orders: number
  active_orders: number
  delivered_orders: number
  delayed_orders: number
  total_order_value: string
}

export interface PurchaseOrderPayload {
  vendor_id: number
  contract_id?: number | null
  order_number: string
  title: string
  description?: string | null
  order_value: number | string
  order_date: string
  expected_delivery_date: string
  status?: PurchaseOrderStatus
}

export type PurchaseOrderUpdatePayload = Partial<PurchaseOrderPayload> & {
  actual_delivery_date?: string | null
}

export interface PurchaseOrderStatusUpdatePayload {
  status: PurchaseOrderStatus
}

export interface DeliveryRecordPayload {
  actual_delivery_date: string
  status?: PurchaseOrderStatus
}

export type PurchaseOrderSortField =
  | 'order_number'
  | 'title'
  | 'order_value'
  | 'order_date'
  | 'expected_delivery_date'
  | 'actual_delivery_date'
  | 'status'
  | 'created_at'
  | 'updated_at'

export interface PurchaseOrderQuery {
  page?: number
  page_size?: number
  search?: string
  vendor_id?: number
  contract_id?: number
  status?: PurchaseOrderStatus
  sort_by?: PurchaseOrderSortField
  sort_order?: 'asc' | 'desc'
}

export type QualityStatus =
  | 'EXCELLENT'
  | 'GOOD'
  | 'ACCEPTABLE'
  | 'POOR'
  | 'CRITICAL'

export interface QualityEvaluationVendorSummary {
  id: number
  vendor_code: string
  company_name: string
}

export interface QualityEvaluationContractSummary {
  id: number
  contract_number: string
  title: string
}

export interface QualityEvaluationPurchaseOrderSummary {
  id: number
  order_number: string
  title: string
}

export interface QualityEvaluatorSummary {
  id: number
  first_name: string
  last_name: string
  email: string
}

export interface QualityEvaluationListItem {
  id: number
  vendor: QualityEvaluationVendorSummary
  contract: QualityEvaluationContractSummary | null
  purchase_order: QualityEvaluationPurchaseOrderSummary | null
  evaluation_date: string
  quality_score: number
  defect_count: number
  total_items: number
  quality_status: QualityStatus
  evaluator: QualityEvaluatorSummary
  created_at: string
}

export interface QualityEvaluationDetail extends QualityEvaluationListItem {
  vendor_id: number
  contract_id: number | null
  purchase_order_id: number | null
  comments: string | null
  updated_at: string
}

export interface PaginatedQualityEvaluations {
  items: QualityEvaluationListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface QualityEvaluationStatistics {
  total_evaluations: number
  excellent: number
  good: number
  acceptable: number
  poor: number
  critical: number
  average_quality_score: number | null
  total_defects: number
}

export interface QualityEvaluationPayload {
  vendor_id: number
  contract_id?: number | null
  purchase_order_id?: number | null
  evaluation_date: string
  quality_score: number
  defect_count?: number
  total_items?: number
  quality_status: QualityStatus
  comments?: string | null
}

export type QualityEvaluationUpdatePayload = Partial<QualityEvaluationPayload>

export type QualityEvaluationSortField =
  | 'evaluation_date'
  | 'quality_score'
  | 'defect_count'
  | 'total_items'
  | 'quality_status'
  | 'created_at'
  | 'updated_at'

export interface QualityEvaluationQuery {
  page?: number
  page_size?: number
  search?: string
  vendor_id?: number
  contract_id?: number
  purchase_order_id?: number
  quality_status?: QualityStatus
  sort_by?: QualityEvaluationSortField
  sort_order?: 'asc' | 'desc'
}

export interface VendorQualitySummary {
  vendor_id: number
  total_evaluations: number
  average_quality_score: number | null
  excellent_evaluations: number
  good_evaluations: number
  acceptable_evaluations: number
  poor_evaluations: number
  critical_evaluations: number
  total_defects: number
}

export type IncidentType =
  | 'DELIVERY'
  | 'QUALITY'
  | 'SERVICE'
  | 'CONTRACT'
  | 'COMPLIANCE'
  | 'COMMUNICATION'
  | 'DOCUMENTATION'
  | 'PAYMENT'
  | 'OTHER'

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export interface IncidentVendorSummary {
  id: number
  vendor_code: string
  company_name: string
}

export interface IncidentContractSummary {
  id: number
  contract_number: string
  title: string
}

export interface IncidentPurchaseOrderSummary {
  id: number
  order_number: string
  title: string
}

export interface IncidentUserSummary {
  id: number
  first_name: string
  last_name: string
  email: string
}

export interface IncidentListItem {
  id: number
  incident_number: string
  vendor: IncidentVendorSummary
  contract: IncidentContractSummary | null
  purchase_order: IncidentPurchaseOrderSummary | null
  title: string
  incident_type: IncidentType
  severity: IncidentSeverity
  status: IncidentStatus
  reported_date: string
  due_date: string | null
  resolved_date: string | null
  impact_score: number
  assigned_to_user: IncidentUserSummary | null
  updated_at: string
}

export interface IncidentDetail extends IncidentListItem {
  vendor_id: number
  contract_id: number | null
  purchase_order_id: number | null
  description: string
  reported_by: number
  reported_by_user: IncidentUserSummary
  assigned_to: number | null
  resolution_notes: string | null
  created_at: string
}

export interface PaginatedIncidents {
  items: IncidentListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface IncidentStatistics {
  total_incidents: number
  open: number
  in_progress: number
  resolved: number
  closed: number
  critical: number
  high: number
  medium: number
  low: number
  overdue: number
  average_impact_score: number | null
}

export interface IncidentPayload {
  vendor_id: number
  contract_id?: number | null
  purchase_order_id?: number | null
  title: string
  description: string
  incident_type: IncidentType
  severity: IncidentSeverity
  reported_date: string
  due_date?: string | null
  impact_score: number
  assigned_to?: number | null
  status?: IncidentStatus
}

export type IncidentUpdatePayload = Partial<IncidentPayload> & {
  resolved_date?: string | null
  resolution_notes?: string | null
}

export type IncidentSortField =
  | 'incident_number'
  | 'reported_date'
  | 'due_date'
  | 'impact_score'
  | 'incident_type'
  | 'severity'
  | 'status'
  | 'created_at'
  | 'updated_at'

export interface IncidentQuery {
  page?: number
  page_size?: number
  search?: string
  vendor_id?: number
  contract_id?: number
  purchase_order_id?: number
  incident_type?: IncidentType
  severity?: IncidentSeverity
  incident_status?: IncidentStatus
  date_from?: string
  date_to?: string
  sort_by?: IncidentSortField
  sort_order?: 'asc' | 'desc'
}

export interface VendorIncidentSummary {
  vendor_id: number
  total_incidents: number
  open_incidents: number
  in_progress_incidents: number
  resolved_incidents: number
  closed_incidents: number
  critical_incidents: number
  high_incidents: number
  medium_incidents: number
  low_incidents: number
  average_impact_score: number | null
}

export interface UserListItem {
  id: number
  first_name: string
  last_name: string
  email: string
  role_name: string | null
  is_active: boolean
}

export type VendorPerformanceClassification =
  | 'EXCELLENT'
  | 'GOOD'
  | 'AVERAGE'
  | 'POOR'
  | 'CRITICAL'
  | 'INSUFFICIENT_DATA'

export interface DeliveryPerformanceSubscore {
  score: number | null
  total_orders: number
  completed_deliveries: number
  on_time_deliveries: number
  delayed_deliveries: number
  data_available: boolean
}

export interface QualityPerformanceSubscore {
  score: number | null
  total_evaluations: number
  average_quality_score: number | null
  data_available: boolean
}

export interface IncidentPerformanceSubscore {
  score: number
  total_incidents: number
  open: number
  in_progress: number
  resolved: number
  closed: number
  critical: number
  high: number
  medium: number
  low: number
  overdue: number
  data_available: boolean
}

export interface VendorPerformanceListItem {
  vendor_id: number
  vendor_name: string
  vendor_code: string
  overall_score: number | null
  classification: VendorPerformanceClassification
  limited_data: boolean
  data_confidence: number
  delivery_score: number | null
  quality_score: number | null
  incident_score: number
  available_components: string[]
  missing_components: string[]
}

export interface VendorPerformanceDetail {
  vendor_id: number
  vendor_name: string
  vendor_code: string
  overall_score: number | null
  classification: VendorPerformanceClassification
  limited_data: boolean
  data_confidence: number
  available_components: string[]
  missing_components: string[]
  delivery: DeliveryPerformanceSubscore
  quality: QualityPerformanceSubscore
  incidents: IncidentPerformanceSubscore
  strengths: string[]
  weaknesses: string[]
  attention_areas: string[]
}

export type VendorPerformanceSortField =
  | 'vendor_name'
  | 'overall_score'
  | 'delivery_score'
  | 'quality_score'
  | 'incident_score'
  | 'data_confidence'

export interface VendorPerformanceQuery {
  page?: number
  page_size?: number
  search?: string
  classification?: VendorPerformanceClassification
  sort_by?: VendorPerformanceSortField
  sort_order?: 'asc' | 'desc'
}

export interface PaginatedVendorPerformance {
  items: VendorPerformanceListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface VendorPerformanceStatistics {
  total_vendors: number
  excellent: number
  good: number
  average: number
  poor: number
  critical: number
  insufficient_data: number
  requiring_attention: number
  limited_data: number
}

export interface PerformanceDistributionItem {
  classification: VendorPerformanceClassification
  label: string
  count: number
  percentage: number
}

export interface PerformanceDistribution {
  total_vendors: number
  items: PerformanceDistributionItem[]
}

export interface VendorRankingItem {
  rank: number
  vendor_id: number
  vendor_name: string
  vendor_code: string
  overall_score: number
  classification: VendorPerformanceClassification
  limited_data: boolean
  data_confidence: number
  delivery_score: number | null
  quality_score: number | null
  incident_score: number | null
}

export interface VendorRanking {
  total_vendors: number
  vendors_with_score: number
  items: VendorRankingItem[]
}

export interface DeliveryAnalytics {
  total_orders: number
  completed_orders: number
  pending_orders: number
  on_time_deliveries: number
  delayed_deliveries: number
  on_time_rate: number | null
  total_delay_days: number
  average_delay_days: number | null
}

export interface QualityAnalytics {
  total_evaluations: number
  average_quality_score: number | null
}

export interface IncidentAnalytics {
  total_incidents: number
  open: number
  in_progress: number
  resolved: number
  closed: number
  unresolved: number
  critical: number
  high: number
  medium: number
  low: number
  overdue: number
  resolution_rate: number | null
}

export interface AnalyticsInsight {
  key: string
  kind: 'positive' | 'watch' | 'warning' | 'info'
  title: string
  detail: string
}

export interface AnalyticsOverview {
  start_date: string
  end_date: string
  total_vendors: number
  vendors_in_scope: number
  vendors_with_score: number
  average_performance_score: number | null
  performance_change: number | null
  performance_change_period_label: string | null
  vendors_requiring_attention: number
  distribution: PerformanceDistributionItem[]
  delivery: DeliveryAnalytics
  quality: QualityAnalytics
  incidents: IncidentAnalytics
  insights: AnalyticsInsight[]
}

export interface TrendPoint {
  period: string
  start_date: string
  end_date: string
  has_data: boolean
}

export interface DeliveryTrendPoint extends TrendPoint {
  completed_deliveries: number
  on_time_rate: number | null
  delivery_score: number | null
}

export interface DeliveryTrend {
  granularity: 'monthly' | 'daily'
  has_sufficient_data: boolean
  summary: DeliveryAnalytics
  items: DeliveryTrendPoint[]
}

export interface QualityTrendPoint extends TrendPoint {
  evaluations: number
  average_score: number | null
}

export interface QualityTrend {
  granularity: 'monthly' | 'daily'
  has_sufficient_data: boolean
  summary: QualityAnalytics
  items: QualityTrendPoint[]
}

export interface IncidentTrendPoint extends TrendPoint {
  incidents: number
  unresolved: number
  critical: number
  incident_score: number | null
}

export interface IncidentTrend {
  granularity: 'monthly' | 'daily'
  has_sufficient_data: boolean
  summary: IncidentAnalytics
  items: IncidentTrendPoint[]
}

export interface PerformanceTrendPoint extends TrendPoint {
  average_overall_score: number | null
  vendors_contributing: number
}

export interface PerformanceTrend {
  granularity: 'monthly' | 'daily'
  has_sufficient_data: boolean
  items: PerformanceTrendPoint[]
}

export interface IncidentSeverityItem {
  severity: IncidentSeverity
  count: number
  percentage: number
}

export interface IncidentSeverityDistribution {
  total_incidents: number
  items: IncidentSeverityItem[]
}

export interface CategoryPerformanceItem {
  category_id: number
  category_name: string
  vendor_count: number
  vendors_with_score: number
  average_overall_score: number | null
  average_delivery_score: number | null
  average_quality_score: number | null
  average_incident_score: number | null
  best_vendor_name: string | null
  best_overall_score: number | null
}

export interface CategoryPerformance {
  total_categories: number
  items: CategoryPerformanceItem[]
}

export interface VendorComparisonMetric {
  vendor_id: number
  vendor_name: string
  vendor_code: string
  overall_score: number | null
  classification: VendorPerformanceClassification
  limited_data: boolean
  data_confidence: number
  delivery_score: number | null
  quality_score: number | null
  incident_score: number | null
  delivery: DeliveryAnalytics
  quality: QualityAnalytics
  incidents: IncidentAnalytics
}

export interface VendorComparison {
  vendors: VendorComparisonMetric[]
}

export interface AnalyticsQuery {
  start_date?: string
  end_date?: string
  granularity?: 'monthly' | 'daily'
  vendor_id?: number
  category_id?: number
}

export type RiskLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type RiskConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

export type PredictionMethod = 'RULE_BASED' | 'ML_BASED' | 'HYBRID'

export type RiskTrend = 'IMPROVING' | 'STABLE' | 'WORSENING' | 'INSUFFICIENT_DATA'

export interface RiskFactor {
  name: string
  impact: string
  description: string
}

export interface PositiveFactor {
  name: string
  description: string
}

export interface ModelInfo {
  available: boolean
  model_type: string | null
  training_date: string | null
  training_records: number | null
  features: string[] | null
  evaluation_metrics: Record<string, number> | null
  model_version: string | null
  message: string | null
}

export interface PredictiveRisk {
  vendor_id: number
  vendor_name: string
  vendor_code: string
  risk_score: number | null
  risk_level: RiskLevel | null
  confidence: RiskConfidence
  prediction_method: PredictionMethod
  risk_trend: RiskTrend
  risk_factors: RiskFactor[]
  positive_factors: PositiveFactor[]
  feature_summary: string[]
  model_information: ModelInfo | null
  detail: string | null
  generated_at: string
}

export interface VendorRiskListItem {
  vendor_id: number
  vendor_name: string
  vendor_code: string
  category_name: string | null
  performance_score: number | null
  risk_score: number | null
  risk_level: RiskLevel | null
  confidence: RiskConfidence
  prediction_method: PredictionMethod
}

export interface PaginatedVendorRiskList {
  items: VendorRiskListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface RiskStatistics {
  total_vendors: number
  average_risk_score: number | null
  very_low_risk: number
  low_risk: number
  medium_risk: number
  high_risk: number
  critical_risk: number
  high_confidence_predictions: number
  low_confidence_predictions: number
  no_data: number
}

export interface TrainingResult {
  trained: boolean
  status: string
  message: string | null
  model_type: string | null
  training_records: number | null
  evaluation_metrics: Record<string, number> | null
  model_version: string | null
  timestamp: string | null
}

export type VendorRiskSortField =
  | 'risk_score'
  | 'vendor_name'
  | 'performance_score'

export interface VendorRiskQuery {
  page?: number
  page_size?: number
  search?: string
  category_id?: number
  risk_level?: RiskLevel
  sort_by?: VendorRiskSortField
  sort_order?: 'asc' | 'desc'
}