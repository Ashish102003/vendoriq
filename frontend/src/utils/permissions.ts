import type {
  ContractStatus,
  DeliveryStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  PurchaseOrderStatus,
  QualityStatus,
  VendorPerformanceClassification,
  VendorStatus,
} from '../types'

export const VENDOR_STATUSES: VendorStatus[] = [
  'PENDING',
  'ACTIVE',
  'UNDER_REVIEW',
  'SUSPENDED',
  'TERMINATED',
]

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  UNDER_REVIEW: 'Under Review',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
}

export const CONTRACT_STATUSES: ContractStatus[] = [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
  'EXPIRED',
]

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'DRAFT',
  'ISSUED',
  'IN_PROGRESS',
  'DELIVERED',
  'PARTIALLY_DELIVERED',
  'CANCELLED',
  'CLOSED',
]

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  IN_PROGRESS: 'In Progress',
  DELIVERED: 'Delivered',
  PARTIALLY_DELIVERED: 'Partially Delivered',
  CANCELLED: 'Cancelled',
  CLOSED: 'Closed',
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: 'Pending',
  ON_TIME: 'On Time',
  DELAYED: 'Delayed',
}

export const QUALITY_STATUSES: QualityStatus[] = [
  'EXCELLENT',
  'GOOD',
  'ACCEPTABLE',
  'POOR',
  'CRITICAL',
]

export const QUALITY_STATUS_LABELS: Record<QualityStatus, string> = {
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  ACCEPTABLE: 'Acceptable',
  POOR: 'Poor',
  CRITICAL: 'Critical',
}

const VENDOR_EDITOR_ROLES = ['Admin', 'Vendor Manager', 'Procurement Manager']
const STATUS_MANAGER_ROLES = ['Admin', 'Vendor Manager']
const CATEGORY_MANAGER_ROLES = ['Admin', 'Vendor Manager']
const CONTRACT_EDITOR_ROLES = ['Admin', 'Vendor Manager', 'Procurement Manager']
const PO_EDITOR_ROLES = ['Admin', 'Vendor Manager', 'Procurement Manager']
const QUALITY_EDITOR_ROLES = [
  'Admin',
  'Vendor Manager',
  'Procurement Manager',
  'Project Manager',
]
const INCIDENT_EDITOR_ROLES = [
  'Admin',
  'Vendor Manager',
  'Procurement Manager',
  'Project Manager',
]

export const INCIDENT_TYPES: IncidentType[] = [
  'DELIVERY',
  'QUALITY',
  'SERVICE',
  'CONTRACT',
  'COMPLIANCE',
  'COMMUNICATION',
  'DOCUMENTATION',
  'PAYMENT',
  'OTHER',
]

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  DELIVERY: 'Delivery',
  QUALITY: 'Quality',
  SERVICE: 'Service',
  CONTRACT: 'Contract',
  COMPLIANCE: 'Compliance',
  COMMUNICATION: 'Communication',
  DOCUMENTATION: 'Documentation',
  PAYMENT: 'Payment',
  OTHER: 'Other',
}

export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const INCIDENT_STATUSES: IncidentStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const PERFORMANCE_CLASSIFICATIONS: VendorPerformanceClassification[] = [
  'EXCELLENT',
  'GOOD',
  'AVERAGE',
  'POOR',
  'CRITICAL',
  'INSUFFICIENT_DATA',
]

export const PERFORMANCE_CLASSIFICATION_LABELS: Record<VendorPerformanceClassification, string> = {
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  AVERAGE: 'Average',
  POOR: 'Poor',
  CRITICAL: 'Critical',
  INSUFFICIENT_DATA: 'Insufficient Data',
}

export function canCreateVendor(roleName: string): boolean {
  return VENDOR_EDITOR_ROLES.includes(roleName)
}

export function canManageVendorStatus(roleName: string): boolean {
  return STATUS_MANAGER_ROLES.includes(roleName)
}

export function canManageCategories(roleName: string): boolean {
  return CATEGORY_MANAGER_ROLES.includes(roleName)
}

export function canManageContracts(roleName: string): boolean {
  return CONTRACT_EDITOR_ROLES.includes(roleName)
}

export function canManageContractStatus(roleName: string): boolean {
  return CONTRACT_EDITOR_ROLES.includes(roleName)
}

export function canManagePurchaseOrders(roleName: string): boolean {
  return PO_EDITOR_ROLES.includes(roleName)
}

export function canRecordDelivery(roleName: string): boolean {
  return PO_EDITOR_ROLES.includes(roleName)
}

export function canManagePurchaseOrderStatus(roleName: string): boolean {
  return PO_EDITOR_ROLES.includes(roleName)
}

export function canManageQualityEvaluations(roleName: string): boolean {
  return QUALITY_EDITOR_ROLES.includes(roleName)
}

export function canManageIncidents(roleName: string): boolean {
  return INCIDENT_EDITOR_ROLES.includes(roleName)
}