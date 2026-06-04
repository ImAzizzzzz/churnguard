# ChurnGuard — Bank Customer Churn Prediction Platform

A full-stack web application that helps bank analysts **predict and prevent customer churn**.
It combines a machine-learning prediction engine, interactive analytics dashboards, a retention
workflow, and role-based administration.

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, Vite, TailwindCSS, Recharts, Zustand, React Router, Axios, jsPDF |
| **Backend** | FastAPI, SQLAlchemy, Pydantic, JWT (python-jose), bcrypt |
| **Database** | PostgreSQL |
| **Machine Learning** | scikit-learn (Random Forest), SHAP, joblib |

---

## Project structure

```
churn-app/
├── backend/                # FastAPI REST API
│   ├── main.py             # App entry point + startup tasks
│   ├── config.py           # Settings (reads .env)
│   ├── database.py         # SQLAlchemy engine/session
│   ├── models/             # ORM models (users, permissions, history, workflow…)
│   ├── routers/            # REST endpoints (auth, predict, analytics, reports…)
│   ├── services/           # auth_service, ml_service
│   ├── ml/                 # Trained model files (model.joblib, pipeline.joblib)
│   └── tests/              # pytest unit tests
└── frontend/               # React single-page application
    └── src/
        ├── pages/          # Dashboard, Predict, Insights, Reports, Admin…
        ├── components/     # Layout, Sidebar, ChartCard, ChatBot…
        ├── store/          # Zustand stores (auth, ui, permissions)
        └── hooks/          # usePermissions, useTheme…
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- **PostgreSQL** running locally

---

## 1. Database setup

Create a PostgreSQL database (e.g. `churndb`) and note the connection URL.
The customer data tables (`clients_clean`, `churn_predictions`) are produced by the
data-preparation / ML pipeline; you can also import a CSV from the in-app **Data Upload** page.

---

## 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/churndb
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRE_MINUTES=60
FIRST_SUPERADMIN_EMAIL=admin@churnguard.tn
FIRST_SUPERADMIN_PASSWORD=admin123
# Optional — enables the AI chatbot's full answers:
# ANTHROPIC_API_KEY=sk-ant-...
```

Run the API:

```bash
uvicorn main:app --reload --port 8000
```

On first start the app creates the tables and the **super-admin account** from the
`.env` values. Interactive API docs: <http://localhost:8000/docs>

---

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

**Default login** (from your `.env`):
- Email: `admin@churnguard.tn`
- Password: `admin123`

---

## 4. Running the tests

```bash
cd backend
venv\Scripts\python -m pytest -q
```

The suite covers password hashing, JWT handling, and the retention-recommendation engine.

---

## Features

- **Dashboard** — live KPIs, revenue at risk, risk segments, model performance, churn trend, customer-base overview, PDF/PNG export, model-info panel.
- **Prediction** — single-customer churn scoring with a probability gauge, SHAP explanations, what-if simulator, and tailored retention recommendations.
- **Insights** — churn-pattern analysis by tenure, age, balance, segment, KYC, marital status and client nature, plus cohort comparison.
- **Workflow** — watchlist and intervention tracking for at-risk customers.
- **Reports** — prediction history (CSV + PDF export), risk filtering, batch prediction, AI retention strategy, scheduled digest.
- **Customer 360** — full per-customer profile, accessible via the global search bar.
- **Administration** — user management, data upload, and per-feature / per-chart permissions (super-admin only).

---

## Roles

| Role | Access |
|------|--------|
| `admin` | All analytics + prediction + workflow features |
| `super_admin` | Everything, plus user management, data upload, and permissions |

---

## Machine learning model

The churn model is a **scikit-learn Random Forest** (AUC ≈ 0.92). The pipeline —
cleaning, KYC ordinal encoding, top-N grouping, one-hot encoding, MinMax scaling,
tree-based selection of the top 30 features — mirrors the data-science notebooks and is
reproduced in **`backend/train_model.py`**, which trains directly from the `clients_clean`
table and writes the serving artifacts to `backend/ml/`:

```
backend/ml/
├── model.joblib            # trained Random Forest (compact, depth/leaf limited)
├── scaler.joblib           # fitted MinMax scaler
├── encoded_columns.json    # full one-hot feature space
├── selected_features.json  # the 30 features the model uses
└── scaled_columns.json     # numeric columns scaled (AGE, TENURE, ACCT_BALANCE, SCORE_KYC)
```

Regenerate the model at any time (requires the database to be populated):

```bash
cd backend
venv\Scripts\python train_model.py
```

At startup the API loads these artifacts and serves **live single-customer predictions**
with SHAP explanations on the Prediction page. Risk segments use the model's bins:
`< 0.30 Low · 0.30–0.60 Medium · ≥ 0.60 High`.

---

## Notes

- The app degrades gracefully: if no trained model is present in `backend/ml/`, the Prediction
  page falls back to demo mode while the rest of the app keeps working.
- The Help Assistant gives built-in answers by default; set `ANTHROPIC_API_KEY` for full AI replies.
- The scheduled digest is a preview feature — preferences are saved but no email is sent yet.
