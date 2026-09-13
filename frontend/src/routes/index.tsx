import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '../context/AuthProvider'
import { ToastProvider } from '../components/common/ToastProvider'
import { GuestRoute, ProtectedRoute } from './guards'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { ComingSoonPage } from '../pages/ComingSoonPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { VendorListPage } from '../pages/vendors/VendorListPage'
import { VendorFormPage } from '../pages/vendors/VendorFormPage'
import { VendorDetailPage } from '../pages/vendors/VendorDetailPage'
import { VendorCategoriesPage } from '../pages/vendors/VendorCategoriesPage'
import { ContractsPage } from '../pages/contracts/ContractsPage'
import { ContractFormPage } from '../pages/contracts/ContractFormPage'
import { ContractDetailPage } from '../pages/contracts/ContractDetailPage'
import { PurchaseOrdersPage } from '../pages/purchase-orders/PurchaseOrdersPage'
import { PurchaseOrderFormPage } from '../pages/purchase-orders/PurchaseOrderFormPage'
import { PurchaseOrderDetailPage } from '../pages/purchase-orders/PurchaseOrderDetailPage'
import { QualityEvaluationsPage } from '../pages/quality-evaluations/QualityEvaluationsPage'
import { QualityEvaluationFormPage } from '../pages/quality-evaluations/QualityEvaluationFormPage'
import { QualityEvaluationDetailPage } from '../pages/quality-evaluations/QualityEvaluationDetailPage'
import { IncidentsPage } from '../pages/incidents/IncidentsPage'
import { IncidentFormPage } from '../pages/incidents/IncidentFormPage'
import { IncidentDetailPage } from '../pages/incidents/IncidentDetailPage'
import { VendorPerformancePage } from '../pages/vendor-performance/VendorPerformancePage'
import { AnalyticsPage } from '../pages/analytics/AnalyticsPage'
import { VendorRiskPage } from '../pages/risk/VendorRiskPage'
import { AiInsightsPage } from '../pages/AiInsightsPage'
import { SettingsPage } from '../pages/SettingsPage'

export function AppRoutes() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* The app now opens straight on the login page: the legacy landing
              page was removed, so "/" immediately redirects to "/login". */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendors"
            element={
              <ProtectedRoute>
                <VendorListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendors/new"
            element={
              <ProtectedRoute>
                <VendorFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendors/:vendorId"
            element={
              <ProtectedRoute>
                <VendorDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendors/:vendorId/edit"
            element={
              <ProtectedRoute>
                <VendorFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor-categories"
            element={
              <ProtectedRoute>
                <VendorCategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts"
            element={
              <ProtectedRoute>
                <ContractsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/new"
            element={
              <ProtectedRoute>
                <ContractFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/:contractId"
            element={
              <ProtectedRoute>
                <ContractDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/:contractId/edit"
            element={
              <ProtectedRoute>
                <ContractFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders"
            element={
              <ProtectedRoute>
                <PurchaseOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders/new"
            element={
              <ProtectedRoute>
                <PurchaseOrderFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders/:purchaseOrderId"
            element={
              <ProtectedRoute>
                <PurchaseOrderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders/:purchaseOrderId/edit"
            element={
              <ProtectedRoute>
                <PurchaseOrderFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quality-evaluations"
            element={
              <ProtectedRoute>
                <QualityEvaluationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quality-evaluations/new"
            element={
              <ProtectedRoute>
                <QualityEvaluationFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quality-evaluations/:evaluationId"
            element={
              <ProtectedRoute>
                <QualityEvaluationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quality-evaluations/:evaluationId/edit"
            element={
              <ProtectedRoute>
                <QualityEvaluationFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents"
            element={
              <ProtectedRoute>
                <IncidentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents/new"
            element={
              <ProtectedRoute>
                <IncidentFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents/:incidentId"
            element={
              <ProtectedRoute>
                <IncidentDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents/:incidentId/edit"
            element={
              <ProtectedRoute>
                <IncidentFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor-performance"
            element={
              <ProtectedRoute>
                <VendorPerformancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor-risk"
            element={
              <ProtectedRoute>
                <VendorRiskPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-insights"
            element={
              <ProtectedRoute>
                <AiInsightsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coming-soon/:module"
            element={
              <ProtectedRoute>
                <ComingSoonPage />
              </ProtectedRoute>
            }
          />
          <Route path="/not-found" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}