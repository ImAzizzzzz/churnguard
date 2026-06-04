# Phase 5 — Polish & Power UX Design Spec

**Goal:** Fix labels/charts/filters across all pages, improve sidebar UX, add a profile page, expand per-chart permissions to cover every chart in the app.

**Architecture:** Three independent sub-projects shipped in order: (1) pure frontend fixes, (2) sidebar/UX features with a minor backend endpoint, (3) profile page + permissions expansion touching DB model, router, and every chart component.

**Tech Stack:** React 19 + Zustand 5 + Tailwind 3 (frontend); FastAPI + SQLAlchemy + PostgreSQL (backend).

---

## Sub-project 1 — Quick fixes (frontend only)

### 1a. Dashboard: delete three charts

Remove the following chart components and their API calls entirely from `Dashboard.jsx`:
- **Churn rate by geography** (Nationality/Residence toggle) — nearly all customers are TN, useless signal
- **Churn rate by account category** — sparse data
- **Churn rate by industry** — sparse data

Also remove their entries from the `ENDPOINTS` map and the `arr()` calls that reference them. Remove the `can('show_churn_by_industry')` guard (the chart is gone). Remove `show_churn_by_nationality` and `show_churn_by_industry` from `permissionsStore.js` DEFAULT_PERMISSIONS (they'll be dead keys once the charts are gone; keeping them in the DB is harmless).

### 1b. Marital status labels (Dashboard + Insights)

Both pages render raw single-letter codes from the DB. Add a shared mapping:

```js
// used in both Dashboard.jsx and Insights.jsx
const MARITAL_LABEL = {
  C: 'Célibataire', M: 'Marié(e)', D: 'Divorcé(e)',
  V: 'Veuf/Veuve', S: 'Séparé(e)',
}
const maritalLabel = (code) => MARITAL_LABEL[String(code).toUpperCase()] ?? code
```

Apply this to the `name` field in both `<BarChart>` / `<PieChart>` data arrays and to any tooltip formatters.

### 1c. Predict page — KYC labels

Replace raw A/B/C/D option values with readable labels in the KYC Score `<select>` and in the What-if simulator KYC select:

```
A → A — Excellent
B → B — Good
C → C — Fair
D → D — At Risk
```

Keep the option `value` as the single letter (the backend expects it). Only the displayed label changes.

### 1d. Predict page — remove Nationality and Residence fields

Remove the `<Field label="Nationality">` and `<Field label="Residence">` blocks from the prediction form. Remove `nationality` and `residence` from `EMPTY_FORM` and `DEMO_FORM`. Remove the `options.nationalities` and `options.residences` fetch logic (or leave the API call but just stop rendering those fields — either is fine).

### 1e. Predict page — tenure / age display format

Wherever the raw numeric tenure or age value is shown (input helper text, the What-if simulator slider label), show it as a human-readable string alongside the raw number:

```js
function formatYMD(decimalYears) {
  const totalMonths = Math.round(decimalYears * 12)
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  if (y === 0) return `${m} mo`
  if (m === 0) return `${y} yr${y !== 1 ? 's' : ''}`
  return `${y} yr${y !== 1 ? 's' : ''} ${m} mo`
}
```

Apply to:
- The tenure input: show `formatYMD(Number(form.tenure))` in small gray text next to the label
- The What-if simulator tenure slider: replace the raw value badge with `formatYMD(scenario.tenure)`
- The age input: show `"X yrs"` (age is always whole years, no months needed)

### 1f. Insights — delete churn-yes/no toggle and currency chart

Remove the "All predictions (churn yes / churn no)" filter button/toggle from `CustomerExplorer` in `Insights.jsx`.
Remove the "Churn rate by currency" chart component and its API call.

### 1g. Reports — fix risk filter mapping

In `Reports.jsx` (Batch Results tab and Prediction History tab), the frontend sends the English label ("High") but the DB stores French labels ("Élevé"). Fix by mapping before the API call:

```js
const RISK_API_MAP = { High: 'Élevé', Medium: 'Moyen', Low: 'Faible' }
// when building query params:
const apiRisk = RISK_API_MAP[riskFilter] ?? riskFilter
```

Apply the same map to the Prediction History risk filter (`histRisk`).

---

## Sub-project 2 — Sidebar + Workflow + AI strategy

### 2a. Sticky sidebar

In `Layout.jsx` (or wherever the sidebar column lives), add `h-screen sticky top-0 overflow-y-auto` to the sidebar wrapper so it never scrolls off screen regardless of page height.

### 2b. Collapsible sidebar

Add `sidebarCollapsed: false` and `toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed }))` to `uiStore.js` (persisted via the existing `persist` middleware or a separate `localStorage` key).

**Sidebar behavior:**
- Expanded: current width (`w-64`), labels visible
- Collapsed: `w-16`, nav item labels hidden, icons centered, `title` prop on each nav item for native hover tooltip
- A toggle button at the very bottom of the sidebar (chevron `‹` / `›`) calls `toggleSidebar()`
- Transition: `transition-all duration-200` on both the sidebar and the main content margin (`ml-64` ↔ `ml-16`)

No changes to routing or auth. Layout reads `sidebarCollapsed` from `uiStore`.

### 2c. Workflow page onboarding banner

At the top of `Workflow.jsx`, add a dismissible info card:

```
📋 What is this page?
The Workflow page helps you track high-risk customers through your retention process.
• Watchlist — flag customers you want to monitor
• Interventions — log actions taken (calls, fee waivers, offers) and track outcomes
Dismiss this banner with the × button (hidden until next session).
```

Dismissed state lives in `sessionStorage` (resets on browser close — intentional, so new sessions always see it briefly).

### 2d. AI-powered strategy in Reports

In the Batch Results tab, replace the static "Strategy" tooltip/card for each customer row with an AI call:

- "Get AI advice" button per row (or inside the expanded row panel)
- On click: `POST /chat/` with body:
  ```json
  { "message": "Give 3 specific retention actions for a [High/Medium] risk customer with account balance [X] TND, [tenure] years of tenure, in the [segment] segment. Be concise." }
  ```
- Show a spinner while pending, render the response as plain text (no markdown parsing needed)
- Cache the response in local component state so re-opening the same row doesn't re-call
- Uses `{ silent: true }` so errors show via the global toast, not a duplicate inline error

No new backend endpoint. Reuses the existing `POST /chat/` endpoint.

---

## Sub-project 3 — Profile page + per-chart permissions expansion

### 3a. Profile page

**New route:** `/profile` in `App.jsx` — protected, accessible by all authenticated users.

**New component:** `frontend/src/pages/Profile.jsx`

**UI:**
- Avatar: large colored circle (background derived from name hash) showing initials
- Fields displayed: Full Name, Email (read-only always), Role badge, Phone, Department
- All users see an "Edit" button that opens an inline form for `full_name` and `phone`
- On save: `PUT /users/me` → success toast, update `authStore` user object

**Sidebar link:** clicking the user's name/avatar block at the bottom of the sidebar navigates to `/profile` (use `useNavigate`).

**New backend endpoint:** `PUT /users/me`

```python
# routers/auth.py  (or a new users.py router)
@router.put("/users/me")
def update_me(body: UpdateMeBody, db=Depends(get_db), user=Depends(get_current_user)):
    # Updates full_name and phone only. Email and role are immutable here.
```

`UpdateMeBody`: `{ full_name: str | None, phone: str | None }`

### 3b. Per-chart permissions expansion

**Goal:** Super admin can toggle visibility of every chart card in Dashboard, Insights, and the Predict simulator — per admin user — from the Permissions admin panel.

**New `UserPermissions` columns** (added via startup `ALTER TABLE … ADD COLUMN IF NOT EXISTS`):

Dashboard additions:
- `show_revenue_at_risk` (default True)
- `show_churn_trend` (default True)
- `show_high_risk_table` (default True)
- `show_churn_by_marital` (default True)

Insights additions:
- `show_insights_marital` (default True)
- `show_insights_tenure` (default True)
- `show_insights_balance` (default True)
- `show_insights_age` (default True)
- `show_insights_kyc` (default True)
- `show_cohort_compare` (default True)

Predict additions:
- `show_what_if_simulator` (default True)

Existing columns kept as-is:
- `show_risk_chart`, `show_confusion_matrix`, `show_probability_dist`, `show_churn_by_age`, `show_churn_by_tenure`, `show_churn_by_balance`

(Industry and nationality columns are kept in DB — harmless dead columns — but their charts are deleted in Sub-project 1.)

**Backend changes:**
- Add all new keys to `_BOOLEAN_FIELDS` in `permissions.py`
- Add `ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS …` for each new column in `main.py` startup migration

**Frontend changes:**
- Add all new keys to `DEFAULT_PERMISSIONS` in `permissionsStore.js`
- Wrap each chart component in Dashboard, Insights, Predict with a `can('show_xyz')` guard (same pattern as `can('show_churn_by_industry')` already in Dashboard)

**Admin panel Permissions UI:**
Group the chart toggles by page section instead of a flat list:

```
Dashboard charts:    [Revenue at Risk] [Churn Trend] [High Risk Table]
                     [Risk Distribution] [Confusion Matrix] [Prob Distribution]
                     [Age] [Tenure] [Balance] [Marital Status]

Insights charts:     [Marital] [Tenure] [Balance] [Age] [KYC] [Cohort Compare]

Predict:             [What-if Simulator]
```

---

## Constraints (carried from all prior phases)

- No date/time columns used — all aggregates are count-based
- No trained ML model assumed — What-if simulator already uses `{ silent: true }` re-calls
- All new DB columns use `ADD COLUMN IF NOT EXISTS` (safe on existing DBs)
- AI chat calls use `{ silent: true }` + toast fallback

---

## Files touched

**Sub-project 1 (frontend only):**
- `frontend/src/pages/Dashboard.jsx` — delete 3 charts, fix marital labels
- `frontend/src/pages/Insights.jsx` — fix marital labels, delete currency chart, delete churn-yes/no toggle
- `frontend/src/pages/Predict.jsx` — KYC labels, remove nationality/residence, tenure/age format
- `frontend/src/pages/Reports.jsx` — risk filter mapping fix
- `frontend/src/store/permissionsStore.js` — remove dead nationality/industry keys

**Sub-project 2:**
- `frontend/src/store/uiStore.js` — add `sidebarCollapsed` + `toggleSidebar`
- `frontend/src/components/Sidebar.jsx` — collapse toggle button + icon-only mode + sticky
- `frontend/src/components/Layout.jsx` — adjust main margin based on collapsed state
- `frontend/src/pages/Workflow.jsx` — onboarding banner
- `frontend/src/pages/Reports.jsx` — AI strategy button (reuses POST /chat/)

**Sub-project 3:**
- `backend/models/permissions.py` — new Boolean columns
- `backend/routers/permissions.py` — add new keys to `_BOOLEAN_FIELDS`
- `backend/routers/auth.py` — new `PUT /users/me` endpoint
- `backend/main.py` — startup migrations for new columns
- `frontend/src/store/permissionsStore.js` — new default keys
- `frontend/src/pages/Dashboard.jsx` — `can()` guards for new charts
- `frontend/src/pages/Insights.jsx` — `can()` guards for new charts
- `frontend/src/pages/Predict.jsx` — `can()` guard for simulator
- `frontend/src/pages/Permissions.jsx` — grouped chart toggle UI
- `frontend/src/pages/Profile.jsx` — new page
- `frontend/src/App.jsx` — new `/profile` route
- `frontend/src/components/Sidebar.jsx` — profile link at bottom
