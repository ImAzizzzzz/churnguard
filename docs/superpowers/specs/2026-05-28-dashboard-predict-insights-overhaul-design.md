# ChurnGuard — Dashboard / Predict / Insights Overhaul
**Date:** 2026-05-28  
**Status:** Approved  
**Scope:** All 5 phases (A–E) confirmed by user

---

## 1. Overview

A comprehensive overhaul of the three main feature pages of the ChurnGuard banking churn-prediction platform. The work spans bug fixes, UX improvements, new analytics, a new prediction history system, and on-demand AI recommendations.

### Affected files

| File | Change type |
|------|------------|
| `backend/analytics.py` | Add 3 new endpoints (nature_client, account_category, options) |
| `backend/routers/predict.py` | Save predictions to history; add history CRUD endpoints |
| `backend/routers/customers.py` | Add `/customers/options` endpoint |
| `backend/models/prediction_history.py` | New SQLAlchemy model |
| `backend/main.py` | Register prediction_history table on startup |
| `frontend/src/pages/Dashboard.jsx` | Model perf metrics, new charts, labels, party class ref |
| `frontend/src/pages/Predict.jsx` | Searchable dropdowns, auto-fill, LOB tooltip, on-demand recs |
| `frontend/src/pages/Insights.jsx` | Fix churn filter bug, KYC labels |
| `frontend/src/pages/Reports.jsx` | Add Prediction History tab |
| `frontend/src/components/SearchableSelect.jsx` | New reusable combobox component |

---

## 2. Phase A — Bug Fixes & Labels

### A1. Insights "All Prediction" filter bug
- **Root cause:** `Insights.jsx` sends `churn_filter=yes` / `churn_filter=no` but `customers.py` declares it as `Optional[int]`. FastAPI cannot parse "yes" as int, so the filter silently fails or returns 422.
- **Fix:** Change the select option values in `Insights.jsx` from `"yes"/"no"` to `"1"/"0"`. The API call passes these as integers.

### A2. Model Performance — Metric Cards
**Computed client-side** from the existing confusion matrix response (`/analytics/actual-vs-predicted`):
```
Accuracy  = (TP + TN) / (TP + TN + FP + FN)
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1-Score  = 2 · Precision · Recall / (Precision + Recall)
```
**Layout:**
- Top section: 2×2 grid of metric cards (Accuracy, Precision, Recall, F1). Each card has: large % value + coloured progress ring (SVG arc), metric name, one-line business definition.
- Bottom section: 2×2 grid of raw confusion matrix counts (TP, TN, FP, FN) as smaller secondary cards.
- Colour coding: Accuracy=blue, Precision=violet, Recall=emerald, F1=amber. FP/FN=amber, TP/TN=appropriate signal colours.

### A3. KYC Display Labels
Frontend mapping applied everywhere KYC values are rendered:
```js
const KYC_LABELS = { A: 'Excellent', B: 'Good', C: 'Medium Risk', D: 'High Risk' }
const KYC_COLORS = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' }
```
Applied in: Dashboard KYC bar chart X-axis + tooltip, Insights KYC chart.

### A4. Industry Code → Name Mapping
Frontend constant `INDUSTRY_MAP` covering common Tunisian banking industry codes. Unmapped codes display as `"Industry ${code}"` so nothing breaks.
```js
const INDUSTRY_MAP = {
  '1': 'Agriculture', '2': 'Mining', '3': 'Manufacturing',
  '4': 'Energy', '5': 'Construction', '6': 'Commerce',
  '7': 'Transport', '8': 'Finance', '9': 'Real Estate',
  '10': 'Tourism', '11': 'Telecom', '12': 'Health',
  '13': 'Education', '14': 'Public Services', '15': 'Retail Banking',
  // extend as needed
}
```
Applied to industry chart Y-axis labels, tooltips, and any industry value display.

### A5. Party Class Reference Table
A collapsible info panel shown below the "Churn rate by party class" chart. Displays the 9 classification codes in a compact table:

| Code | French Name | Classification |
|------|------------|----------------|
| PPH | Personne Physique | Client physique |
| TRPP | Tiers Personne Physique | Client physique |
| PRO | Professionnel | Client moral |
| PM | Personne Morale | Client moral |
| TRPM | Tiers Personne Morale | Client moral |
| CB | Compte Bancaire | Cas spécial |
| TIERS | Compte de Tiers | Cas spécial |
| PROSPECT | Prospect | Cas spécial |
| TRBQ | Très Bonne Qualité | Cas spécial |

Classification badges: "Client physique" = blue, "Client moral" = violet, "Cas spécial" = amber.  
The panel is collapsed by default with a "Show classification reference ▾" toggle button.

### A6. LOB Tooltip + Mapping (Predict page)
- ⓘ icon next to "LOB" field label, hover tooltip: *"Line of Business — the banking product line this account belongs to."*
- Helper text under the input listing common codes:
  `1=Retail · 2=Corporate · 3=Insurance · 4=Telecom · 5=Commerce · 6=Manufacturing`

### A7. "Others" Party Class
Add `<option value="Others">Others / Autres</option>` as last item in the party class dropdown in `Predict.jsx`.

---

## 3. Phase B — Dashboard Analytics

### New backend endpoints (`analytics.py`)
```
GET /analytics/churn-by-nature-client
GET /analytics/churn-by-account-category
```
Both follow the same pattern as existing endpoints:
```sql
SELECT <column>, COUNT(*) as total, SUM(churn) as churned,
       ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
FROM clients_clean
WHERE <column> IS NOT NULL
GROUP BY <column> ORDER BY churn_rate DESC
```
Both wrapped in try/except returning `[]` if the column doesn't exist (defensive).

### New frontend charts (Dashboard.jsx)
Two new chart cards added after the existing Marital/KYC/Currency row:
1. **Churn rate by nature client** — horizontal bar chart, colour `#8b5cf6`
2. **Churn rate by account category** — vertical bar chart, colour `#f97316`

### Nationality / Residence display fix
Frontend mapping objects applied to chart labels before rendering:
```js
const NATIONALITY_MAP = { TUN: 'Tunisia', LIB: 'Libya', ALG: 'Algeria', MAR: 'Morocco', ... }
const RESIDENCE_MAP   = { /* city codes → readable names */ }
```
Values not in the map pass through unchanged.

### UX improvements
- Consistent colour palette: each chart type (bar/pie/horizontal) uses a fixed colour, not random palette
- `ChartCard` titles rewritten in plain business language (e.g. "Churn Rate by Customer Segment" instead of "churn-by-partyclass")
- Empty states provide actionable guidance

---

## 4. Phase C — Predict Page UX

### C1. SearchableSelect component (`components/SearchableSelect.jsx`)
Props: `value, onChange, options, placeholder, loading, disabled`  
Features:
- Type to filter options (case-insensitive substring match)
- Keyboard navigation: ↑↓ to move, Enter to select, Escape to close
- Click outside to close
- Loading spinner state while options are fetched
- Empty state: "No matches found"
- Scrollable list (max-height 240px)
- Zero external dependencies (pure React + Tailwind)

### C2. Customer options API (`GET /customers/options`)
New endpoint in `customers.py`. Returns distinct non-null values for three columns:
```json
{
  "nationalities": ["Tunisia", "Libya", ...],
  "residences": ["Tunis", "Sfax", "Sousse", ...],
  "nature_clients": ["PPH", "PM", "PRO", ...]
}
```
Fetched once on `Predict` component mount. Falls back to `[]` for each on error.

### C3. Auto-fill from customer search
When a customer is selected from the search results:
1. Map customer fields to form fields: `age → age`, `tenure → tenure`, `acct_balance → acct_balance`, `partyclass → partyclass`, `score_kyc → score_kyc`, `nationality → nationality`, `residence → residence`, `marital_status → marital_status`, `currency → currency`, `nature_client → nature_client`
2. Show banner: *"Form pre-filled from customer #[customer_no] — fields are editable before predicting."*
3. Banner dismisses after 5 seconds or on manual close
4. All fields remain editable after auto-fill (no locking)
5. `isDirty` flag reset; the pre-fill counts as clean state

### C4. LOB tooltip + mapping (see A6 above)

### C5. "Others" party class (see A7 above)

### C6. On-demand AI Recommendations
- After prediction result appears, **recommendations panel is hidden**
- A button "✨ Generate AI Recommendations" appears in its place
- Clicking: set `recsLoading=true`, call existing `generate_recommendations` logic (client-side, no new API needed since the logic is already in `ml_service.py` and returned in the prediction response)
- Show skeleton cards for 800ms, then reveal recommendation cards with a 100ms stagger fade-in per card
- Each revealed card has: copy-to-clipboard button, and shares the same card style as before
- "↺ Regenerate" button stays visible after generation

---

## 5. Phase D — Prediction History

### DB table (`models/prediction_history.py`)
```python
class PredictionHistory(Base):
    __tablename__ = "prediction_history"
    id            = Column(UUID, primary_key=True, default=uuid4)
    admin_id      = Column(UUID, nullable=True)   # FK users.id (nullable for resilience)
    admin_name    = Column(String, nullable=True)
    customer_data = Column(JSON, nullable=True)    # full input snapshot
    churn_prob    = Column(Float, nullable=True)
    risk_level    = Column(String, nullable=True)
    confidence    = Column(String, nullable=True)
    shap_json     = Column(JSON, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
```

### Backend (`predict.py`) changes
`POST /predict/` — after ML inference, asynchronously insert into `prediction_history`. Wrapped in try/except so a DB failure never fails the prediction.

New endpoints:
```
GET    /predict/history          — paginated (page, page_size), filter: risk_level, date_from, date_to
DELETE /predict/history/{id}     — super_admin only
GET    /predict/history/export   — CSV download, same filters as list
```

### Frontend — Reports.jsx (new "Prediction History" tab)
Tab strip: **Batch Results** | **Prediction History**

Prediction History tab:
- Search input: filter by customer_no (from customer_data JSON)
- Risk filter dropdown: All / High / Medium / Low
- Date range pickers (from/to)
- Table columns: Date & Time · Admin · Customer No · Churn Prob · Risk · Actions
- Click row → expand detail panel showing full customer snapshot + SHAP summary
- Pagination: 20 per page
- Export CSV button (downloads full filtered history)
- Delete button per row (super_admin only), with confirmation popover

---

## 6. Error Handling & Resilience

- All new backend endpoints wrapped in try/except returning empty data (not 500)
- Prediction history save failure never propagates to the prediction response
- `SearchableSelect` gracefully handles empty options array and loading state
- Auto-fill handles partial matches (fills only fields that exist in customer data)
- Industry/nationality/KYC mapping functions return original value if code not found

---

## 7. Implementation Order

Recommended parallel execution:

**Stream 1 (Backend):**
1. Create `prediction_history.py` model
2. Add history endpoints to `predict.py`
3. Add 3 new analytics endpoints to `analytics.py`
4. Add `/customers/options` to `customers.py`
5. Update `main.py` for table creation

**Stream 2 (Dashboard.jsx):**
1. Model performance section redesign (metrics + raw matrix)
2. KYC label mapping
3. Industry name mapping
4. Party class reference table
5. Two new charts (nature_client, account_category)

**Stream 3 (Predict + Insights + Reports):**
1. `SearchableSelect.jsx` component
2. Predict.jsx: searchable dropdowns + auto-fill + LOB + "Others" + on-demand recs
3. Insights.jsx: churn filter fix + KYC labels
4. Reports.jsx: prediction history tab

---

## 8. Out of Scope (not included)

- Gender charts (column not confirmed in DB)
- Framer Motion animations (no new dependency; CSS transitions only)
- React Select or any external component library (zero new deps rule)
- Changing the existing churn_predictions table schema
- Internationalization beyond display labels
