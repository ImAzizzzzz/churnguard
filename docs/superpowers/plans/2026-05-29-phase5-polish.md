# Phase 5 — Polish & Power UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix labels/charts/filters across all pages, add a collapsible sticky sidebar, a profile page, Workflow onboarding, AI-powered strategy modal, and expand per-chart permissions to every chart in the app.

**Architecture:** Three independent sub-projects in order: (1) pure frontend fixes with two backend filter normalisation patches, (2) sidebar UX + Workflow onboarding + AI strategy, (3) backend permissions expansion + PUT /users/me + Profile page. Each sub-project ends with a build check and commit.

**Tech Stack:** React 19 + Zustand 5 + Tailwind 3 + FastAPI + SQLAlchemy + PostgreSQL. Repo root `C:\Users\abedh`, all app files under `Downloads/churn-app/`. Backend venv at `Downloads/churn-app/backend/venv/Scripts/python`.

---

## SUB-PROJECT 1 — Quick fixes

---

### Task 1: Dashboard — delete dead charts

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Remove four ENDPOINTS entries**

In `Dashboard.jsx` find the `ENDPOINTS` object (lines ~54-71) and delete the four lines:
```js
// DELETE these four lines from ENDPOINTS:
  industry:      '/analytics/churn-by-industry',
  nationality:   '/analytics/churn-by-nationality',
  residence:     '/analytics/churn-by-residence',
  acctCategory:  '/analytics/churn-by-account-category',
```
Result: ENDPOINTS has 11 keys (kpis, partyclass, age, tenure, balance, riskSegments, confusion, probDist, natureClient, revenueAtRisk, churnTrend, highRisk).

- [ ] **Step 2: Remove dead const destructuring**

In the component body (~line 576-586), remove:
```js
// DELETE these four lines:
  const industry     = arr('industry')
  const nationality  = arr('nationality')
  const residence    = arr('residence')
  const acctCategory = arr('acctCategory')
```

- [ ] **Step 3: Remove the geography + account-category grid block**

Find and delete this entire block (~lines 836-861):
```jsx
{/* Geography (Nationality / Residence toggle) */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <GeoToggleChart
    nationality={nationality}
    residence={residence}
    errNat={failed('nationality')}
    errRes={failed('residence')}
    chart={chart}
    tip={tip}
  />

  {/* Account category */}
  <ChartCard title="Churn rate by account category" subtitle="Account product category">
    {failed('acctCategory') ? <LoadError /> : acctCategory.length > 0 ? (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={acctCategory} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={36} />
          <Tooltip content={tip} cursor={false} />
          <Bar dataKey="churn_rate" name="Churn Rate" radius={[5, 5, 0, 0]} fill="#f97316" opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    ) : <EmptyState icon="chart" title="No account category data" description="Column account_category not found in dataset." />}
  </ChartCard>
</div>
```

- [ ] **Step 4: Remove the industry chart block**

Find and delete (~lines 878-893):
```jsx
{/* Industry */}
{can('show_churn_by_industry') && (
<ChartCard title="Churn rate by industry" subtitle="Top industries by churn rate">
  {failed('industry') ? <LoadError /> : industry.length > 0 ? (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={industry.map(r => ({ ...r, label: industryLabel(r.name) }))} layout="vertical" barCategoryGap="18%">
        <CartesianGrid horizontal={false} stroke={chart.grid} />
        <XAxis type="number" tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} />
        <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: chart.axis }} width={100} axisLine={false} tickLine={false} />
        <Tooltip content={tip} cursor={false} />
        <Bar dataKey="churn_rate" name="Churn Rate" radius={[0, 5, 5, 0]} fill="#3b82f6" opacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  ) : <EmptyState icon="chart" title="No industry data" description="Connect the database to see industry-level churn breakdown." />}
</ChartCard>
)}
```

- [ ] **Step 5: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/pages/Dashboard.jsx
git commit -m "fix(dashboard): remove geography, account-category, industry charts"
```

---

### Task 2: Insights — delete currency chart + churn filter, fix marital labels

**Files:**
- Modify: `frontend/src/pages/Insights.jsx`

- [ ] **Step 1: Add MARITAL_LABEL map and apply it to the marital chart**

At the top of `Insights.jsx`, after the `KYC_LABELS` constant (line ~10), add:
```js
const MARITAL_LABEL = {
  C: 'Célibataire', M: 'Marié(e)', D: 'Divorcé(e)',
  V: 'Veuf/Veuve',  S: 'Séparé(e)',
}
const maritalLabel = (code) => MARITAL_LABEL[String(code).toUpperCase()] ?? code
```

Then in the marital BarChart (around line 922), change:
```jsx
// OLD:
<BarChart data={marital} barCategoryGap="25%">
// NEW:
<BarChart data={marital.map(r => ({ ...r, name: maritalLabel(r.name) }))} barCategoryGap="25%">
```

Also update the CohortCompare marital entry (~line 958):
```jsx
// OLD:
{ key: 'marital', label: 'Marital', data: marital },
// NEW:
{ key: 'marital', label: 'Marital', data: marital.map(r => ({ ...r, name: maritalLabel(r.name) })) },
```

- [ ] **Step 2: Delete the currency chart block**

Find and replace the entire `{/* Marital + Currency ... */}` grid (~lines 915-948) with just the marital card alone (no grid wrapper needed):
```jsx
{/* Marital status */}
<div className="card p-6">
  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Churn rate by marital status</p>
  <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">Secondary demographic signal</p>
  {marital.length > 0 ? (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={marital.map(r => ({ ...r, name: maritalLabel(r.name) }))} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={32} />
        <Tooltip content={tip} cursor={false} />
        <Bar dataKey="churn_rate" name="Churn Rate" radius={[5, 5, 0, 0]} fill="#ec4899" opacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  ) : <EmptyState icon="chart" title="No marital data" />}
</div>
```

- [ ] **Step 3: Remove currency from CohortCompare dimensions**

Find the CohortCompare dimensions array (~line 952-961) and delete the currency entry:
```jsx
// DELETE this line:
{ key: 'currency', label: 'Currency', data: currency },
```

- [ ] **Step 4: Remove the churn filter select**

Find the `<select value={churnFilter}` block (~lines 321-328) and delete it entirely:
```jsx
// DELETE:
<select value={churnFilter} onChange={e => setChurnFilter(e.target.value)}
  className="px-3 py-2 h-9 text-sm rounded-xl cursor-pointer appearance-none
             bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
             text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all">
  <option value="">All predictions</option>
  <option value="1">Churn: Yes</option>
  <option value="0">Churn: No</option>
</select>
```

- [ ] **Step 5: Remove churnFilter state and all its references**

Search Insights.jsx for `churnFilter` and remove:
- `const [churnFilter, setChurnFilter] = useState('')` — delete this line
- Any `churnFilter` in the `if (!query && !riskFilter && !churnFilter)` guard — simplify to `if (!query && !riskFilter)`
- Any `churnFilter` passed to `saveCurrentView`, `applyView`, or `fetchCustomers`
- The `if (churn) params.append('churn_filter', churn)` line
- Any `churnFilter` in useEffect dependency arrays
- Any `churnFilter` in the "Clear filters" / action label conditions

- [ ] **Step 6: Remove currency state, fetch, and import**

In the `useState` declarations (around line 747), delete:
```js
const [currency, setCurrency] = useState([])
```

In the fetch block (around line 760-767), delete the `api.get('/analytics/churn-by-currency')` call and `setCurrency(ar(cur))`.

- [ ] **Step 7: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`.

- [ ] **Step 8: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/pages/Insights.jsx
git commit -m "fix(insights): remove currency chart + churn filter, translate marital labels"
```

---

### Task 3: Predict — KYC labels, remove nationality/residence, format tenure/age

**Files:**
- Modify: `frontend/src/pages/Predict.jsx`

- [ ] **Step 1: Add formatYMD helper**

Near the top of `Predict.jsx` (after imports, before component code), add:
```js
/** Convert decimal years to "X yrs Y mo" display string */
function formatYMD(decimalYears) {
  const n = Number(decimalYears)
  if (!n || isNaN(n)) return ''
  const totalMonths = Math.round(n * 12)
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  if (y === 0) return `${m} mo`
  if (m === 0) return `${y} yr${y !== 1 ? 's' : ''}`
  return `${y} yr${y !== 1 ? 's' : ''} ${m} mo`
}
```

- [ ] **Step 2: Fix KYC labels in the main form select**

Find the KYC Score `<select>` in the prediction form (~line 704). Replace:
```jsx
// OLD — the options are likely <option value="A">A</option> etc. or an empty <select>
<select value={form.score_kyc} onChange={e => set('score_kyc', e.target.value)} className="input-field appearance-none cursor-pointer">
  <option value="">Select KYC score</option>
  <option value="A">A</option>
  <option value="B">B</option>
  <option value="C">C</option>
  <option value="D">D</option>
</select>
// NEW:
<select value={form.score_kyc} onChange={e => set('score_kyc', e.target.value)} className="input-field appearance-none cursor-pointer">
  <option value="">Select KYC score</option>
  <option value="A">A — Excellent</option>
  <option value="B">B — Good</option>
  <option value="C">C — Fair</option>
  <option value="D">D — At Risk</option>
</select>
```

- [ ] **Step 3: Fix KYC labels in the What-if simulator**

Find `SIM_KYC = ['A', 'B', 'C', 'D']` (~line 291) and replace:
```js
// OLD:
const SIM_KYC = ['A', 'B', 'C', 'D']
// NEW:
const SIM_KYC = [
  { value: 'A', label: 'A — Excellent' },
  { value: 'B', label: 'B — Good' },
  { value: 'C', label: 'C — Fair' },
  { value: 'D', label: 'D — At Risk' },
]
```

Then update the simulator KYC `<select>` (around line 407-410):
```jsx
// OLD:
{SIM_KYC.map(s => <option key={s}>{s}</option>)}
// NEW:
{SIM_KYC.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
```

- [ ] **Step 4: Remove Nationality and Residence from form**

Delete the two `<Field label="Nationality">` and `<Field label="Residence">` blocks (~lines 718-731).

In `EMPTY_FORM` and `DEMO_FORM` (top of file), remove:
```js
nationality: '',
residence: '',
```

In the autofill handler (~line 586-587), remove:
```js
if (r.nationality) patch.nationality = r.nationality
if (r.residence)   patch.residence   = r.residence
```

- [ ] **Step 5: Add tenure/age formatted display**

Find the Tenure input `<Field label="Tenure (yrs)">` (~line 663). Change the label to show the formatted value:
```jsx
// OLD:
<Field label="Tenure (yrs)" error={errors.tenure}>
  <input type="number" value={form.tenure}
    onChange={e => set('tenure', e.target.value)}
    onBlur={() => touch('tenure')}
    className={fieldCls('tenure')} placeholder="3" />
</Field>
// NEW:
<Field
  label={
    <span className="flex items-center gap-2">
      Tenure (yrs)
      {form.tenure ? <span className="text-[11px] font-normal text-blue-500 dark:text-blue-400">{formatYMD(form.tenure)}</span> : null}
    </span>
  }
  error={errors.tenure}
>
  <input type="number" value={form.tenure}
    onChange={e => set('tenure', e.target.value)}
    onBlur={() => touch('tenure')}
    className={fieldCls('tenure')} placeholder="3" />
</Field>
```

For the What-if simulator tenure slider label (~line 360):
```jsx
// OLD:
<span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{scenario.tenure || 0}</span>
// NEW:
<span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
  {scenario.tenure ? formatYMD(scenario.tenure) : '0'}
</span>
```

- [ ] **Step 6: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`.

- [ ] **Step 7: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/pages/Predict.jsx
git commit -m "fix(predict): KYC readable labels, remove nationality/residence, tenure YMD display"
```

---

### Task 4: Reports — fix risk filter bugs (history + batch backend)

**Files:**
- Modify: `frontend/src/pages/Reports.jsx`
- Modify: `backend/routers/reports.py`
- Modify: `backend/routers/predict.py`

- [ ] **Step 1: Fix History tab filter option values**

In `Reports.jsx`, find the History tab risk `<select>` (~lines 723-731):
```jsx
// OLD:
<option value="">All risk levels</option>
<option value="High">High</option>
<option value="Medium">Medium</option>
<option value="Low">Low</option>
// NEW (lowercase matches what ml_service stores):
<option value="">All risk levels</option>
<option value="high">High</option>
<option value="medium">Medium</option>
<option value="low">Low</option>
```

- [ ] **Step 2: Fix batch backend to accept both EN and FR risk values**

In `backend/routers/reports.py`, after the imports add:
```python
_RISK_VARIANTS = {
    'high':   ('Élevé', 'High', 'high'),
    'High':   ('Élevé', 'High', 'high'),
    'Élevé':  ('Élevé', 'High', 'high'),
    'medium': ('Moyen', 'Medium', 'medium'),
    'Medium': ('Moyen', 'Medium', 'medium'),
    'Moyen':  ('Moyen', 'Medium', 'medium'),
    'low':    ('Faible', 'Low', 'low'),
    'Low':    ('Faible', 'Low', 'low'),
    'Faible': ('Faible', 'Low', 'low'),
}
```

Then update the `list_predictions` endpoint to use `IN` instead of `=`:
```python
@router.get("/predictions")
def list_predictions(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    risk: Optional[str] = None,
    db=Depends(get_db_session),
    user: User = Depends(require_admin),
):
    risk_clause = ""
    base_params: dict = {"limit": limit, "offset": offset}
    if risk:
        variants = _RISK_VARIANTS.get(risk, (risk,))
        ph = ", ".join(f":r{i}" for i in range(len(variants)))
        risk_clause = f"AND segment_risque IN ({ph})"
        base_params.update({f"r{i}": v for i, v in enumerate(variants)})

    rows = db.execute(text(f"""
        SELECT customer_no, account_no, churn_reel, churn_predit,
               probabilite_churn, segment_risque
        FROM churn_predictions
        WHERE 1=1 {risk_clause}
        ORDER BY probabilite_churn DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """), base_params).fetchall()

    total_params = dict(base_params)
    total_params.pop("limit"); total_params.pop("offset")
    total = db.execute(text(f"""
        SELECT COUNT(*) FROM churn_predictions WHERE 1=1 {risk_clause}
    """), total_params).scalar()

    return {
        "total": total,
        "data": [
            {
                "customer_no": r[0], "account_no": r[1],
                "churn_reel": r[2], "churn_predit": r[3],
                "probabilite_churn": round(float(r[4]), 3) if r[4] is not None else None,
                "segment_risque": r[5],
            }
            for r in rows
        ],
    }
```

Apply the same pattern to `export_csv`:
```python
@router.get("/export-csv")
def export_csv(
    risk: Optional[str] = None,
    db=Depends(get_db_session),
    user: User = Depends(require_admin),
):
    risk_clause = ""
    params: dict = {}
    if risk:
        variants = _RISK_VARIANTS.get(risk, (risk,))
        ph = ", ".join(f":r{i}" for i in range(len(variants)))
        risk_clause = f"AND segment_risque IN ({ph})"
        params.update({f"r{i}": v for i, v in enumerate(variants)})

    rows = db.execute(text(f"""
        SELECT customer_no, account_no, churn_reel, churn_predit,
               probabilite_churn, segment_risque
        FROM churn_predictions
        WHERE 1=1 {risk_clause}
        ORDER BY probabilite_churn DESC NULLS LAST
    """), params).fetchall()
    # rest of function unchanged...
```

- [ ] **Step 3: Fix predict history backend to accept both cases**

In `backend/routers/predict.py`, add the same risk_variants map after imports:
```python
_RISK_VARIANTS_EN = {
    'high': ('high', 'High'), 'High': ('high', 'High'),
    'Élevé': ('high', 'High'),
    'medium': ('medium', 'Medium'), 'Medium': ('medium', 'Medium'),
    'Moyen': ('medium', 'Medium'),
    'low': ('low', 'Low'), 'Low': ('low', 'Low'),
    'Faible': ('low', 'Low'),
}
```

In `list_history`, replace:
```python
# OLD:
if risk_level:
    conditions.append("risk_level = :risk_level")
    params["risk_level"] = risk_level
# NEW:
if risk_level:
    variants = _RISK_VARIANTS_EN.get(risk_level, (risk_level,))
    ph = ", ".join(f":rl{i}" for i in range(len(variants)))
    conditions.append(f"risk_level IN ({ph})")
    params.update({f"rl{i}": v for i, v in enumerate(variants)})
```

Apply the same change in `export_history_csv` if it has the same `risk_level` filter logic.

- [ ] **Step 4: Syntax-check backend**

```powershell
cd C:\Users\abedh\Downloads\churn-app\backend
venv\Scripts\python -c "import ast; ast.parse(open('routers/reports.py').read()); ast.parse(open('routers/predict.py').read()); print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Build frontend**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/pages/Reports.jsx Downloads/churn-app/backend/routers/reports.py Downloads/churn-app/backend/routers/predict.py
git commit -m "fix(reports): normalize risk filter to match FR/EN/case variants in DB"
```

---

## SUB-PROJECT 2 — Sidebar + UX

---

### Task 5: uiStore + Sidebar — collapsible + sticky

**Files:**
- Modify: `frontend/src/store/uiStore.js`
- Modify: `frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: Add sidebarCollapsed to uiStore**

Replace the entire content of `uiStore.js` with:
```js
import { create } from 'zustand'

let _id = 0

const _saved = () => {
  try { return JSON.parse(localStorage.getItem('cg-sidebar-collapsed')) === true }
  catch { return false }
}

export const useUiStore = create((set, get) => ({
  sessionExpired: false,
  setSessionExpired: (v) => set({ sessionExpired: v }),

  // ── Sidebar ──────────────────────────────────────────
  sidebarCollapsed: _saved(),
  toggleSidebar: () => set((s) => {
    const next = !s.sidebarCollapsed
    try { localStorage.setItem('cg-sidebar-collapsed', JSON.stringify(next)) } catch {}
    return { sidebarCollapsed: next }
  }),

  // ── Toast notifications ──────────────────────────────
  toasts: [],
  pushToast: (toast) => {
    const id = ++_id
    const t = {
      id,
      type: toast.type || 'info',
      title: toast.title || '',
      message: toast.message || '',
      duration: toast.duration ?? 4500,
    }
    set((s) => ({ toasts: [...s.toasts, t] }))
    if (t.duration > 0) {
      setTimeout(() => get().dismissToast(id), t.duration)
    }
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}))

/* Convenience helpers usable outside React components (e.g. axios interceptor) */
export const toast = {
  info:    (title, message) => useUiStore.getState().pushToast({ type: 'info',    title, message }),
  success: (title, message) => useUiStore.getState().pushToast({ type: 'success', title, message }),
  error:   (title, message) => useUiStore.getState().pushToast({ type: 'error',   title, message }),
  warning: (title, message) => useUiStore.getState().pushToast({ type: 'warning', title, message }),
}
```

- [ ] **Step 2: Rewrite Sidebar.jsx with collapse + sticky + profile link**

Replace the entire content of `frontend/src/components/Sidebar.jsx` with:
```jsx
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

const NAV = [
  {
    to: '/dashboard', label: 'Dashboard',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  },
  {
    to: '/predict', label: 'Prediction',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    to: '/insights', label: 'Insights',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
  {
    to: '/workflow', label: 'Workflow',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  },
  {
    to: '/reports', label: 'Reports',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  },
]

const ADMIN_NAV = [
  {
    to: '/admin', label: 'Admin Panel',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />,
  },
]

function NavIcon({ children }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      {children}
    </svg>
  )
}

function NavItem({ to, label, icon, locked, collapsed }) {
  if (locked) {
    return (
      <div
        title={collapsed ? label : 'Requires super admin role'}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed opacity-40 select-none">
        <span className="text-gray-400 dark:text-gray-600 ml-1 shrink-0"><NavIcon>{icon}</NavIcon></span>
        {!collapsed && <span className="text-gray-400 dark:text-gray-600">{label}</span>}
      </div>
    )
  }

  return (
    <NavLink to={to} title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }`
      }>
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />
          )}
          <span className={`${isActive ? 'text-blue-600 dark:text-blue-400' : ''} ${collapsed ? '' : 'ml-1'} shrink-0`}>
            <NavIcon>{icon}</NavIcon>
          </span>
          {!collapsed && label}
          {isActive && !collapsed && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </>
      )}
    </NavLink>
  )
}

function AdminNavItem({ to, label, icon, collapsed }) {
  return (
    <NavLink to={to} title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }`
      }>
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-500" />
          )}
          <span className={`${isActive ? 'text-violet-600 dark:text-violet-400' : ''} ${collapsed ? '' : 'ml-1'} shrink-0`}>
            <NavIcon>{icon}</NavIcon>
          </span>
          {!collapsed && label}
          {isActive && !collapsed && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUiStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const handleLogout = () => { logout(); navigate('/login') }
  const initial = (user?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()

  return (
    <aside
      className={`fixed left-0 top-0 z-30 h-screen overflow-y-auto flex flex-col transition-all duration-200 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 ${collapsed ? 'w-16' : 'w-60'}`}>

      {/* Brand */}
      <div className={`shrink-0 border-b border-gray-100 dark:border-gray-800 ${collapsed ? 'px-3 pt-4 pb-3' : 'px-5 pt-6 pb-5'}`}>
        <Link to="/dashboard" className={`flex items-center gap-3 group ${collapsed ? 'justify-center' : ''}`} title={collapsed ? 'ChurnGuard' : undefined}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 bg-blue-600 text-white group-hover:bg-blue-700 transition-colors">
            🏦
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">ChurnGuard</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 leading-none">Intelligence Platform</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-600">
            Analytics
          </p>
        )}

        {NAV.map(({ to, label, icon }) => (
          <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <p className="px-3 pt-5 mb-2 text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-600">
            Administration
          </p>
        )}
        {collapsed && <div className="pt-3" />}
        {ADMIN_NAV.map(({ to, label, icon }) =>
          isSuperAdmin
            ? <AdminNavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
            : <NavItem key={to} to={to} label={label} icon={icon} locked collapsed={collapsed} />
        )}
      </nav>

      {/* Collapse toggle */}
      <div className={`shrink-0 px-2 pb-1 ${collapsed ? 'flex justify-center' : ''}`}>
        <button
          onClick={toggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            }
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* User footer */}
      <div className={`shrink-0 border-t border-gray-100 dark:border-gray-800 px-2 py-3`}>
        <button
          onClick={() => navigate('/profile')}
          title={collapsed ? `${user?.full_name || 'Profile'}` : 'View profile'}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${collapsed ? 'justify-center' : ''}`}>
          {user?.avatar
            ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0 border border-blue-200 dark:border-blue-800/50" />
            : (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50">
                {initial}
              </div>
            )
          }
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-none">
                {user?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 truncate capitalize">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          )}
        </button>
        {!collapsed && (
          <button onClick={handleLogout} title="Sign out"
            className="w-full mt-1 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        )}
        {collapsed && (
          <button onClick={handleLogout} title="Sign out"
            className="w-full mt-1 flex items-center justify-center px-2 py-1.5 rounded-xl text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/store/uiStore.js Downloads/churn-app/frontend/src/components/Sidebar.jsx
git commit -m "feat(sidebar): collapsible icon-only mode, sticky fixed position, profile link"
```

---

### Task 6: Layout — sidebar-aware left margin

**Files:**
- Modify: `frontend/src/components/Layout.jsx`

- [ ] **Step 1: Read the collapsed state and shift the main content**

In `Layout.jsx`, add `useUiStore` import at the top (already imported — just add the selector):
```jsx
// In the Layout component body, after existing store hooks:
const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
```

Then find the outer `<div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">` and replace it with a non-flex wrapper, and give the main content explicit left margin:
```jsx
// OLD:
<div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
  <Sidebar />
  <div className="flex-1 flex flex-col min-w-0">
// NEW:
<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
  <Sidebar />
  <div className={`flex flex-col min-h-screen transition-all duration-200 ${sidebarCollapsed ? 'ml-16' : 'ml-60'}`}>
```

The rest of Layout.jsx stays unchanged.

- [ ] **Step 2: Add PAGE_TITLES entry for profile**

In the `PAGE_TITLES` map add:
```js
'/profile':  { label: 'My Profile',  sub: 'Account settings' },
```

- [ ] **Step 3: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/components/Layout.jsx
git commit -m "feat(layout): sidebar-aware margin, transition on collapse"
```

---

### Task 7: Workflow — onboarding banner

**Files:**
- Modify: `frontend/src/pages/Workflow.jsx`

- [ ] **Step 1: Add onboarding banner component**

At the top of `Workflow.jsx` (after imports, before the first function or export), add:
```jsx
function OnboardingBanner() {
  const [visible, setVisible] = React.useState(
    () => sessionStorage.getItem('wf-onboarding-dismissed') !== '1'
  )
  if (!visible) return null
  return (
    <div className="card p-5 border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-lg shrink-0">
        📋
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">What is the Workflow page?</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
          This page helps you track high-risk customers through your retention process.
        </p>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold shrink-0 mt-px">•</span>
            <span><strong className="text-gray-800 dark:text-gray-200">Watchlist</strong> — flag customers you want to monitor closely before they churn.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold shrink-0 mt-px">•</span>
            <span><strong className="text-gray-800 dark:text-gray-200">Interventions</strong> — log retention actions (calls, fee waivers, offers) and track their outcome (Retained / Churned).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold shrink-0 mt-px">•</span>
            <span><strong className="text-gray-800 dark:text-gray-200">Risk Migration</strong> — see how customer risk levels have shifted over time based on predictions.</span>
          </li>
        </ul>
      </div>
      <button
        onClick={() => { sessionStorage.setItem('wf-onboarding-dismissed', '1'); setVisible(false) }}
        title="Dismiss"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}
```

Make sure `React` is in scope — add `import React from 'react'` if it isn't already, or use `useState` directly (it's already imported as `{ useState }`). If `useState` is already destructured, change `React.useState` to just `useState`.

- [ ] **Step 2: Render the banner at the top of the page**

In the main `Workflow` component's return, add `<OnboardingBanner />` as the first element inside the wrapper:
```jsx
return (
  <div className="space-y-5">
    <OnboardingBanner />
    {/* existing header / tabs ... */}
```

- [ ] **Step 3: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/pages/Workflow.jsx
git commit -m "feat(workflow): add dismissible onboarding banner explaining watchlist + interventions"
```

---

### Task 8: Reports — AI-powered strategy modal

**Files:**
- Modify: `frontend/src/pages/Reports.jsx`

- [ ] **Step 1: Replace static getAdvice + RetentionModal with an AI-calling version**

Find the `getAdvice` function (~line 88) and the entire `RetentionModal` component. Replace both with this new version:

```jsx
/* ── AI Retention Modal ─────────────────────────────── */
function RetentionModal({ row, onClose }) {
  const [advice, setAdvice] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const pct = row.probabilite_churn != null ? Math.round(row.probabilite_churn * 100) : null
  const riskLabel = { 'Élevé': 'High', 'Moyen': 'Medium', 'Faible': 'Low' }[row.segment_risque] ?? row.segment_risque ?? 'Unknown'

  React.useEffect(() => {
    const msg = `Give 3 specific, actionable retention steps for a bank customer with:
- Risk level: ${riskLabel} (${pct != null ? pct + '% churn probability' : 'probability unknown'})
- Customer no: ${row.customer_no}
- Account no: ${row.account_no ?? 'N/A'}
Format your answer as a numbered list. Be concise and practical.`

    api.post('/chat/', { message: msg }, { silent: true })
      .then(({ data }) => {
        setAdvice(data.response || data.message || 'No advice generated.')
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-200 dark:border-gray-800 animate-slide-up max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-lg shrink-0">
              🤖
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Retention Strategy</h3>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                Customer #{row.customer_no}
                {pct != null && <> · <span className={pct >= 70 ? 'text-red-500' : 'text-amber-500'}>{pct}% churn probability</span></>}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm text-gray-500 dark:text-gray-500">Generating AI advice…</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-500 dark:text-red-400">Could not generate advice. Check your connection.</p>
            </div>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {advice}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-xl text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
```

Also add `import React from 'react'` at the top if not present (or change `React.useState` / `React.useEffect` to the destructured form since `useState` and `useEffect` are already imported).

Also update the Strategy button to show for ALL risk levels (not just Élevé/Moyen), since the AI handles any level:
```jsx
// OLD (line ~644):
{(row.segment_risque === 'Élevé' || row.segment_risque === 'Moyen') && (
// NEW:
{row.segment_risque && (
```

- [ ] **Step 2: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/pages/Reports.jsx
git commit -m "feat(reports): replace static strategy modal with AI-generated retention advice"
```

---

## SUB-PROJECT 3 — Profile page + per-chart permissions

---

### Task 9: Backend — new permission columns + migrations

**Files:**
- Modify: `backend/models/permissions.py`
- Modify: `backend/routers/permissions.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add new Boolean columns to UserPermissions model**

Replace the chart visibility section of `backend/models/permissions.py` with:
```python
from sqlalchemy import Column, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid


class UserPermissions(Base):
    __tablename__ = "user_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False, index=True,
    )

    # ---- Page access -------------------------------------------------------
    can_view_dashboard    = Column(Boolean, default=True, nullable=False)
    can_view_predictions  = Column(Boolean, default=True, nullable=False)
    can_view_insights     = Column(Boolean, default=True, nullable=False)
    can_view_reports      = Column(Boolean, default=True, nullable=False)

    # ---- Feature access ----------------------------------------------------
    can_export_data       = Column(Boolean, default=True, nullable=False)
    can_batch_predict     = Column(Boolean, default=True, nullable=False)
    can_view_analytics    = Column(Boolean, default=True, nullable=False)

    # ---- Dashboard charts --------------------------------------------------
    show_risk_chart          = Column(Boolean, default=True, nullable=False)
    show_confusion_matrix    = Column(Boolean, default=True, nullable=False)
    show_probability_dist    = Column(Boolean, default=True, nullable=False)
    show_churn_by_age        = Column(Boolean, default=True, nullable=False)
    show_churn_by_tenure     = Column(Boolean, default=True, nullable=False)
    show_churn_by_balance    = Column(Boolean, default=True, nullable=False)
    show_churn_by_industry   = Column(Boolean, default=True, nullable=False)  # kept (legacy)
    show_churn_by_nationality= Column(Boolean, default=True, nullable=False)  # kept (legacy)
    show_revenue_at_risk     = Column(Boolean, default=True, nullable=False)
    show_churn_trend         = Column(Boolean, default=True, nullable=False)
    show_high_risk_table     = Column(Boolean, default=True, nullable=False)
    show_churn_by_marital_db = Column(Boolean, default=True, nullable=False)  # dashboard marital (unused, charts deleted)
    show_churn_by_partyclass = Column(Boolean, default=True, nullable=False)
    show_churn_by_nature     = Column(Boolean, default=True, nullable=False)

    # ---- Insights charts ---------------------------------------------------
    show_insights_marital    = Column(Boolean, default=True, nullable=False)
    show_insights_tenure     = Column(Boolean, default=True, nullable=False)
    show_insights_balance    = Column(Boolean, default=True, nullable=False)
    show_insights_age        = Column(Boolean, default=True, nullable=False)
    show_insights_kyc        = Column(Boolean, default=True, nullable=False)
    show_cohort_compare      = Column(Boolean, default=True, nullable=False)

    # ---- Predict charts ----------------------------------------------------
    show_what_if_simulator   = Column(Boolean, default=True, nullable=False)
```

- [ ] **Step 2: Add new keys to _BOOLEAN_FIELDS in permissions.py**

In `backend/routers/permissions.py`, replace the `_BOOLEAN_FIELDS` set with:
```python
_BOOLEAN_FIELDS = {
    # page access
    "can_view_dashboard", "can_view_predictions", "can_view_insights", "can_view_reports",
    # features
    "can_export_data", "can_batch_predict", "can_view_analytics",
    # dashboard charts
    "show_risk_chart", "show_confusion_matrix", "show_probability_dist",
    "show_churn_by_age", "show_churn_by_tenure", "show_churn_by_balance",
    "show_churn_by_industry", "show_churn_by_nationality",
    "show_revenue_at_risk", "show_churn_trend", "show_high_risk_table",
    "show_churn_by_partyclass", "show_churn_by_nature",
    # insights charts
    "show_insights_marital", "show_insights_tenure", "show_insights_balance",
    "show_insights_age", "show_insights_kyc", "show_cohort_compare",
    # predict
    "show_what_if_simulator",
}
```

- [ ] **Step 3: Add startup migrations for new columns in main.py**

In `main.py`, in the `startup()` function, inside the existing migration `try` block, add after the existing `ALTER TABLE` lines:
```python
# user_permissions new chart columns
new_perm_cols = [
    "show_revenue_at_risk", "show_churn_trend", "show_high_risk_table",
    "show_churn_by_partyclass", "show_churn_by_nature",
    "show_insights_marital", "show_insights_tenure", "show_insights_balance",
    "show_insights_age", "show_insights_kyc", "show_cohort_compare",
    "show_what_if_simulator",
]
for col in new_perm_cols:
    _conn.execute(_text(
        f"ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS {col} BOOLEAN NOT NULL DEFAULT TRUE"
    ))
_conn.commit()
```

- [ ] **Step 4: Syntax-check backend**

```powershell
cd C:\Users\abedh\Downloads\churn-app\backend
venv\Scripts\python -c "import ast; [ast.parse(open(f).read()) for f in ['models/permissions.py','routers/permissions.py','main.py']]; print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/backend/models/permissions.py Downloads/churn-app/backend/routers/permissions.py Downloads/churn-app/backend/main.py
git commit -m "feat(permissions): expand chart visibility columns to all pages"
```

---

### Task 10: Backend — PUT /users/me endpoint

**Files:**
- Modify: `backend/routers/auth.py`

- [ ] **Step 1: Add UpdateMeBody schema and PUT /users/me endpoint**

In `backend/routers/auth.py`, after the existing imports, the schemas come from `schemas/auth.py`. Open `backend/schemas/auth.py` and check what's there. If `UserUpdate` already exists, we can add a minimal `UpdateMeBody` inline in auth.py.

Add this endpoint after `@router.get("/me")`:
```python
from pydantic import BaseModel as _BaseModel

class _UpdateMeBody(_BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None

@router.put("/users/me", response_model=UserResponse)
def update_me(
    body: _UpdateMeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.full_name is not None:
        user.full_name = body.full_name.strip() or user.full_name
    if body.phone is not None:
        user.phone = body.phone.strip() or None
    db.commit()
    db.refresh(user)
    return to_resp(user)
```

Also add `Optional` to the imports if not present:
```python
from typing import Optional
```

- [ ] **Step 2: Syntax-check**

```powershell
cd C:\Users\abedh\Downloads\churn-app\backend
venv\Scripts\python -c "import ast; ast.parse(open('routers/auth.py').read()); print('OK')"
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/backend/routers/auth.py
git commit -m "feat(auth): add PUT /users/me so any user can update their own name/phone"
```

---

### Task 11: Frontend — permissions store + chart can() guards

**Files:**
- Modify: `frontend/src/store/permissionsStore.js`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/Insights.jsx`
- Modify: `frontend/src/pages/Predict.jsx`

- [ ] **Step 1: Update DEFAULT_PERMISSIONS in permissionsStore.js**

Replace the `DEFAULT_PERMISSIONS` object with:
```js
const DEFAULT_PERMISSIONS = {
  can_view_dashboard: true,
  can_view_predictions: true,
  can_view_insights: true,
  can_view_reports: true,
  can_export_data: true,
  can_batch_predict: true,
  can_view_analytics: true,
  // dashboard charts
  show_risk_chart: true,
  show_confusion_matrix: true,
  show_probability_dist: true,
  show_churn_by_age: true,
  show_churn_by_tenure: true,
  show_churn_by_balance: true,
  show_churn_by_industry: true,
  show_churn_by_nationality: true,
  show_revenue_at_risk: true,
  show_churn_trend: true,
  show_high_risk_table: true,
  show_churn_by_partyclass: true,
  show_churn_by_nature: true,
  // insights charts
  show_insights_marital: true,
  show_insights_tenure: true,
  show_insights_balance: true,
  show_insights_age: true,
  show_insights_kyc: true,
  show_cohort_compare: true,
  // predict
  show_what_if_simulator: true,
}
```

- [ ] **Step 2: Add can() guards to Dashboard charts**

In `Dashboard.jsx`, the `can` helper is already imported from `usePermissions`. Wrap these chart blocks:

**Revenue at risk** (find `<RevenueAtRisk ...` ~line 654):
```jsx
// OLD:
<RevenueAtRisk data={revenueAtRisk} failed={failed('revenueAtRisk')} currencyFmt={currencyFmt} />
// NEW:
{can('show_revenue_at_risk') && <RevenueAtRisk data={revenueAtRisk} failed={failed('revenueAtRisk')} currencyFmt={currencyFmt} />}
```

**Churn trend** (find the churn trend chart block):
```jsx
// Wrap the churn trend ChartCard with:
{can('show_churn_trend') && (
  <ChartCard title="Churn trend" ...>
    ...
  </ChartCard>
)}
```

**High risk table** (find `<HighRiskTable ...`):
```jsx
// OLD:
<HighRiskTable data={d.highRisk} failed={failed('highRisk')} currencyFmt={currencyFmt} />
// NEW:
{can('show_high_risk_table') && <HighRiskTable data={d.highRisk} failed={failed('highRisk')} currencyFmt={currencyFmt} />}
```

**Party class chart** (find the `<ChartCard title="Churn rate by client party class"` or similar):
```jsx
{can('show_churn_by_partyclass') && (
  <ChartCard title="Churn rate by client party class" ...>
```

**Nature client chart** (find `<ChartCard title="Churn rate by client nature"`):
```jsx
{can('show_churn_by_nature') && (
  <ChartCard title="Churn rate by client nature" ...>
```

The existing guards `can('show_risk_chart')`, `can('show_churn_by_age')`, etc. stay as-is.

- [ ] **Step 3: Add can() guards to Insights charts**

In `Insights.jsx`, find and wrap:

**Marital chart** (single card):
```jsx
{can('show_insights_marital') && (
  <div className="card p-6">
    <p className="text-sm font-semibold ...">Churn rate by marital status</p>
    ...
  </div>
)}
```

**KYC chart** (find the KYC BarChart block, it's in the main charts grid):
```jsx
{can('show_insights_kyc') && (
  // KYC card
)}
```

**Age chart** (find `churn-by-age` or the age card):
```jsx
{can('show_insights_age') && (
  // age card
)}
```

**Tenure chart**:
```jsx
{can('show_insights_tenure') && (
  // tenure card
)}
```

**Balance chart**:
```jsx
{can('show_insights_balance') && (
  // balance card
)}
```

**CohortCompare block**:
```jsx
{can('show_cohort_compare') && (
  <CohortCompare dimensions={[...]} />
)}
```

Import `usePermissions` in Insights.jsx if not already imported. Check with:
```bash
grep -n "usePermissions\|can(" frontend/src/pages/Insights.jsx | head -5
```
If missing, add:
```jsx
import { usePermissions } from '../hooks/usePermissions'
// then inside the component:
const { can } = usePermissions()
```

- [ ] **Step 4: Add can() guard to What-if simulator in Predict.jsx**

In `Predict.jsx`, find the `<WhatIfSimulator` render call and wrap:
```jsx
// OLD:
<WhatIfSimulator baseForm={predictedForm} baseProb={result.churn_probability} />
// NEW:
{can('show_what_if_simulator') && <WhatIfSimulator baseForm={predictedForm} baseProb={result.churn_probability} />}
```

Import `usePermissions` in Predict.jsx if not already present.

- [ ] **Step 5: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/store/permissionsStore.js Downloads/churn-app/frontend/src/pages/Dashboard.jsx Downloads/churn-app/frontend/src/pages/Insights.jsx Downloads/churn-app/frontend/src/pages/Predict.jsx
git commit -m "feat(permissions): add can() guards to all charts across Dashboard, Insights, Predict"
```

---

### Task 12: Frontend — Permissions admin UI grouped by page

**Files:**
- Modify: `frontend/src/pages/Permissions.jsx`

- [ ] **Step 1: Replace PERMISSION_KEYS with a grouped structure**

In `Permissions.jsx`, replace the flat `PERMISSION_KEYS` array and the legend card with a grouped structure. Replace everything from `const PERMISSION_KEYS = [` to the closing `]` (around lines 45-52) with:

```js
// Feature permissions shown in the matrix table
const FEATURE_KEYS = [
  { key: 'can_view_dashboard',   label: 'Dashboard',     desc: 'Access main dashboard' },
  { key: 'can_view_predictions', label: 'Predictions',   desc: 'Run predictions' },
  { key: 'can_view_insights',    label: 'Insights',      desc: 'View analytics' },
  { key: 'can_view_reports',     label: 'Reports',       desc: 'Access reports' },
  { key: 'can_export_data',      label: 'Export',        desc: 'Export CSV' },
  { key: 'can_batch_predict',    label: 'Batch',         desc: 'Batch upload' },
]

// Chart permissions grouped by page — shown in an expandable card per user
const CHART_GROUPS = [
  {
    page: 'Dashboard',
    charts: [
      { key: 'show_revenue_at_risk',    label: 'Revenue at Risk' },
      { key: 'show_churn_trend',        label: 'Churn Trend' },
      { key: 'show_high_risk_table',    label: 'High Risk Table' },
      { key: 'show_risk_chart',         label: 'Risk Distribution' },
      { key: 'show_confusion_matrix',   label: 'Confusion Matrix' },
      { key: 'show_probability_dist',   label: 'Probability Dist.' },
      { key: 'show_churn_by_age',       label: 'Age Chart' },
      { key: 'show_churn_by_tenure',    label: 'Tenure Chart' },
      { key: 'show_churn_by_balance',   label: 'Balance Chart' },
      { key: 'show_churn_by_partyclass',label: 'Party Class' },
      { key: 'show_churn_by_nature',    label: 'Client Nature' },
    ],
  },
  {
    page: 'Insights',
    charts: [
      { key: 'show_insights_marital',  label: 'Marital Status' },
      { key: 'show_insights_age',      label: 'Age' },
      { key: 'show_insights_tenure',   label: 'Tenure' },
      { key: 'show_insights_balance',  label: 'Balance' },
      { key: 'show_insights_kyc',      label: 'KYC Score' },
      { key: 'show_cohort_compare',    label: 'Cohort Compare' },
    ],
  },
  {
    page: 'Predict',
    charts: [
      { key: 'show_what_if_simulator', label: 'What-If Simulator' },
    ],
  },
]
```

- [ ] **Step 2: Update the Permission legend card**

Replace the legend `<div className="card p-5">` block with a version that references `FEATURE_KEYS`:
```jsx
<div className="card p-5">
  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-3">Feature Access Keys</p>
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {FEATURE_KEYS.map(({ key, label, desc }) => (
      <div key={key} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">{desc}</p>
        </div>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Update the matrix table to use FEATURE_KEYS**

In the table, replace all references to `PERMISSION_KEYS` with `FEATURE_KEYS` (two occurrences: the `<th>` header mapping and the `<td>` toggle mapping).

- [ ] **Step 4: Add per-user chart permission section after the matrix**

Below the matrix table card, add a new section that shows chart toggles grouped by page:
```jsx
{/* ── Per-user chart visibility ─────────────────────── */}
<div>
  <div className="mb-3">
    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chart Visibility</p>
    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
      Control which charts each user can see. Expand a user to configure.
    </p>
  </div>

  <div className="space-y-3">
    {users.map(u => {
      const userPerms = perms[u.id] || {}
      const initial = (u.full_name?.[0] || u.email?.[0] || '?').toUpperCase()
      const roleBadge = ROLE_BADGE[u.role] || ROLE_BADGE.admin
      return (
        <ChartPermCard
          key={u.id}
          user={u}
          initial={initial}
          roleBadge={roleBadge}
          userPerms={userPerms}
          saving={saving}
          onToggle={togglePerm}
        />
      )
    })}
  </div>
</div>
```

Add the `ChartPermCard` component before the `Permissions` export:
```jsx
function ChartPermCard({ user: u, initial, roleBadge, userPerms, saving, onToggle }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border ${
          u.role === 'super_admin'
            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/50'
            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
        }`}>{initial}</div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.full_name || '—'}</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{u.email}</p>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${roleBadge}`}>
          {u.role.replace('_', ' ')}
        </span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-5">
          {CHART_GROUPS.map(group => (
            <div key={group.page}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-2">{group.page}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {group.charts.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight">{label}</span>
                    <Toggle
                      checked={userPerms[key] !== false}
                      onChange={() => onToggle(u.id, key, userPerms[key] !== false)}
                      disabled={!!saving[`${u.id}-${key}`]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

Add `import React from 'react'` if not already present (or use `useState` directly since it's already destructured).

- [ ] **Step 5: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
cd C:\Users\abedh && git add Downloads/churn-app/frontend/src/pages/Permissions.jsx
git commit -m "feat(permissions): grouped per-user chart visibility toggles by page"
```

---

### Task 13: Frontend — Profile page + route

**Files:**
- Create: `frontend/src/pages/Profile.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Create Profile.jsx**

Create `frontend/src/pages/Profile.jsx`:
```jsx
import { useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/uiStore'
import api from '../api/axios'

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '' })

  const initial = (user?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()
  const initials = (user?.full_name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || initial

  // Generate a stable color from the email
  const colorIdx = (user?.email || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 6
  const AVATAR_COLORS = [
    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50',
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50',
  ]
  const avatarColor = AVATAR_COLORS[colorIdx]

  const handleSave = useCallback(async () => {
    if (!form.full_name.trim()) { toast.error('Validation', 'Name cannot be empty.'); return }
    setSaving(true)
    try {
      const { data } = await api.put('/auth/users/me', {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
      })
      // Update the auth store so the sidebar name updates immediately
      if (setUser) setUser(data)
      toast.success('Profile updated', 'Your changes have been saved.')
      setEditing(false)
    } catch {
      toast.error('Save failed', 'Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [form, setUser])

  const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin' }
  const ROLE_BADGE = {
    super_admin: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/50',
    admin:       'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar + name header */}
      <div className="card p-8 flex flex-col items-center gap-5">
        <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold border-2 ${avatarColor}`}>
          {initials}
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{user?.full_name || '—'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">{user?.email}</p>
          <span className={`mt-2 inline-flex text-[11px] font-semibold px-3 py-0.5 rounded-full border ${ROLE_BADGE[user?.role] || ROLE_BADGE.admin}`}>
            {ROLE_LABEL[user?.role] || user?.role}
          </span>
        </div>
      </div>

      {/* Profile details */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Profile details</p>
          {!editing && (
            <button
              onClick={() => { setForm({ full_name: user?.full_name || '', phone: user?.phone || '' }); setEditing(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* Full name */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">Full name</label>
            {editing ? (
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            ) : (
              <p className="text-sm text-gray-900 dark:text-gray-100 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                {user?.full_name || '—'}
              </p>
            )}
          </div>

          {/* Email — always read-only */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">Email <span className="text-gray-400">(read-only)</span></label>
            <p className="text-sm text-gray-700 dark:text-gray-400 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
              {user?.email || '—'}
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">Phone</label>
            {editing ? (
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+216 XX XXX XXX"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            ) : (
              <p className="text-sm text-gray-900 dark:text-gray-100 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                {user?.phone || <span className="text-gray-400 dark:text-gray-600 italic">Not set</span>}
              </p>
            )}
          </div>

          {/* Department — read-only */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">Department</label>
            <p className="text-sm text-gray-900 dark:text-gray-100 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
              {user?.department || <span className="text-gray-400 dark:text-gray-600 italic">Not set</span>}
            </p>
          </div>
        </div>

        {editing && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary h-9 px-5 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

> **Note:** `setUser` needs to be exported from `authStore`. Check if it exists: `grep -n "setUser" frontend/src/store/authStore.js`. If it doesn't, add `setUser: (u) => set({ user: u })` to the store. If the store uses a different method to update user, call `api.get('/auth/me').then(r => authStore.setState({ user: r.data }))` instead.

- [ ] **Step 2: Add /profile route to App.jsx**

In `App.jsx`, add the import and route:
```jsx
// Add import:
import Profile from './pages/Profile'

// Add route inside <Routes>:
<Route path="/profile" element={
  <ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>
}/>
```

- [ ] **Step 3: Verify build**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit all Phase 5 remaining files**

```bash
cd C:\Users\abedh && git add \
  Downloads/churn-app/frontend/src/pages/Profile.jsx \
  Downloads/churn-app/frontend/src/App.jsx
git commit -m "feat(profile): profile page with editable name/phone, /profile route"
```

---

## Final verification

- [ ] **Full build check**

```bash
cd C:\Users\abedh\Downloads\churn-app\frontend && npm run build 2>&1 | tail -8
```
Expected: `✓ built in X.XXs` — no red errors. Chunk-size warnings about html2canvas/jspdf are OK.

- [ ] **Backend syntax check**

```powershell
cd C:\Users\abedh\Downloads\churn-app\backend
venv\Scripts\python -c "
import ast, os
files = [
  'main.py','routers/auth.py','routers/reports.py',
  'routers/predict.py','routers/permissions.py','models/permissions.py'
]
for f in files:
    ast.parse(open(f).read())
    print(f'OK: {f}')
"
```
Expected: 6 `OK:` lines.
