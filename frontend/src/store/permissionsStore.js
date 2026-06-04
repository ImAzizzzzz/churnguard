import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_PERMISSIONS = {
  can_view_dashboard: true,
  can_view_predictions: true,
  can_view_insights: true,
  can_view_reports: true,
  can_export_data: true,
  can_batch_predict: true,
  can_view_analytics: true,
  show_risk_chart: true,
  show_confusion_matrix: true,
  show_probability_dist: true,
  show_churn_by_age: true,
  show_churn_by_tenure: true,
  show_churn_by_balance: true,
  // Dashboard charts (new)
  show_revenue_at_risk: true,
  show_churn_trend: true,
  show_high_risk_table: true,
  show_churn_by_partyclass: true,
  show_churn_by_nature: true,
  // Insights charts (new)
  show_insights_marital: true,
  show_insights_tenure: true,
  show_insights_balance: true,
  show_insights_age: true,
  show_insights_kyc: true,
  show_cohort_compare: true,
  // Predict (new)
  show_what_if_simulator: true,
}

export const usePermissionsStore = create(persist(
  (set) => ({
    permissions: DEFAULT_PERMISSIONS,
    setPermissions: (p) => set({ permissions: { ...DEFAULT_PERMISSIONS, ...p } }),
    reset: () => set({ permissions: DEFAULT_PERMISSIONS }),
  }),
  { name: 'cg-permissions' }
))
