from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from sqlalchemy import text
from database import SessionLocal
from services.auth_service import require_admin
from models.user import User
import os

router = APIRouter(prefix="/chat", tags=["chat"])

_HIGH = "('Élevé', 'High', 'high')"
_MED = "('Moyen', 'Medium', 'medium')"
_LOW = "('Faible', 'Low', 'low')"


def _scalar(db, sql, default=0):
    try:
        v = db.execute(text(sql)).fetchone()
        return v[0] if v and v[0] is not None else default
    except Exception:
        return default


def build_live_context() -> str:
    """Query the DB for a compact, current snapshot the assistant can reason over.
    Fully defensive: any failure yields an empty/partial context rather than an error."""
    db = SessionLocal()
    try:
        total = _scalar(db, "SELECT COUNT(*) FROM clients_clean")
        if not total:
            return ""  # no data loaded yet — assistant falls back to general knowledge

        churned = _scalar(db, "SELECT COUNT(*) FROM clients_clean WHERE churn = 1")
        avg_balance = _scalar(db, "SELECT ROUND(AVG(acct_balance)::numeric, 2) FROM clients_clean")
        avg_tenure = _scalar(db, "SELECT ROUND(AVG(tenure)::numeric, 1) FROM clients_clean")
        high = _scalar(db, f"SELECT COUNT(*) FROM churn_predictions WHERE segment_risque IN {_HIGH}")
        med = _scalar(db, f"SELECT COUNT(*) FROM churn_predictions WHERE segment_risque IN {_MED}")
        low = _scalar(db, f"SELECT COUNT(*) FROM churn_predictions WHERE segment_risque IN {_LOW}")
        predicted = _scalar(db, "SELECT COUNT(*) FROM churn_predictions WHERE churn_predit = 1")
        churn_rate = round(churned / total * 100, 1) if total else 0

        lines = [
            "## Live platform data (current snapshot — use these real numbers in answers)",
            f"- Total customers: {total:,}",
            f"- Actual churn rate (historical): {churn_rate}% ({churned:,} churned)",
            f"- Average account balance: {float(avg_balance or 0):,.2f}",
            f"- Average tenure: {float(avg_tenure or 0)} years",
            f"- Predicted churners: {predicted:,}",
            f"- Risk segments — High: {high:,} · Medium: {med:,} · Low: {low:,}",
        ]

        # Top churn-rate segments by party class (limited, defensive)
        try:
            rows = db.execute(text(
                "SELECT partyclass, COUNT(*) t, ROUND(100.0*SUM(churn)/COUNT(*),1) r "
                "FROM clients_clean WHERE partyclass IS NOT NULL GROUP BY partyclass "
                "HAVING COUNT(*) > 0 ORDER BY r DESC LIMIT 3"
            )).fetchall()
            if rows:
                seg = ", ".join(f"{r[0]} ({float(r[2])}% of {r[1]:,})" for r in rows)
                lines.append(f"- Highest-churn party classes: {seg}")
        except Exception:
            pass

        # Recent prediction activity from app-managed history
        try:
            recent = _scalar(db, "SELECT COUNT(*) FROM prediction_history")
            if recent:
                lines.append(f"- Predictions logged in history: {recent:,}")
        except Exception:
            pass

        lines.append(
            "When the user asks about current numbers, segments, or trends, answer from this snapshot. "
            "If a specific figure isn't listed here, say it isn't in the current snapshot rather than guessing."
        )
        return "\n".join(lines)
    except Exception:
        return ""
    finally:
        db.close()

SYSTEM_PROMPT = """You are ChurnGuard Assistant, a helpful AI expert on the ChurnGuard bank customer churn prediction platform. Be concise, clear, and friendly.

## The Platform
ChurnGuard is a full-stack web app helping bank analysts predict and prevent customer churn.
- Frontend: React 19 + Vite + TailwindCSS (light/dark mode)
- Backend: FastAPI + PostgreSQL + SQLAlchemy
- Auth: JWT, roles: admin / super_admin

## Features
1. **Dashboard** — Live KPIs (total customers, churn rate, avg balance/tenure, high-risk count), charts by age/tenure/balance/nationality/KYC/currency/industry, risk donut, confusion matrix
2. **Prediction** — Single-customer ML risk assessment, gauge chart, SHAP feature contributions, customer history lookup
3. **Reports** — Full prediction history, risk filter, CSV export, batch CSV upload
4. **Insights** — Churn pattern analysis + AI retention recommendations
5. **Admin Panel** — Create/edit/delete users, assign roles, search/filter (super_admin only)

## Data & Model
- `clients_clean` table: bank customer profiles
- `churn_predictions` table: model output; risk stored in French — Élevé (High), Moyen (Medium), Faible (Low)
- Churn probability: >0.7 = High risk, 0.4–0.7 = Medium, <0.4 = Low
- ML model: scikit-learn (RandomForest), features: age, tenure, acct_balance, partyclass, KYC score, nationality, marital status, currency, industry, LOB
- SHAP values explain each prediction — red bars increase risk, green bars reduce it

## How-To
- Run prediction: Prediction page → fill customer profile → Run Prediction or Ctrl+Enter
- View history: Reports page → filter by risk level
- Batch predict: Reports → upload CSV → results download automatically
- Manage users: Admin Panel (requires super_admin role)

If asked about something outside ChurnGuard, politely redirect to the platform topics."""


class Msg(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Msg]


class ChatResponse(BaseModel):
    reply: str


@router.post("/", response_model=ChatResponse)
def chat(req: ChatRequest, user: User = Depends(require_admin)):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    if api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            live = build_live_context()
            system = SYSTEM_PROMPT + ("\n\n" + live if live else "")
            msgs = [{"role": m.role, "content": m.content} for m in req.messages]
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                system=system,
                messages=msgs,
            )
            return ChatResponse(reply=resp.content[0].text)
        except Exception as e:
            return ChatResponse(reply=f"AI error: {str(e)[:120]}. Using built-in answers instead.\n\n" + _faq(req.messages))

    return ChatResponse(reply=_faq(req.messages))


def _faq(messages: List[Msg]) -> str:
    q = messages[-1].content.lower() if messages else ""

    # Live-data questions — answer with real current numbers when possible
    if any(w in q for w in ["how many", "current", "right now", "today", "total customer",
                            "churn rate", "high risk count", "how much", "number of",
                            "live", "snapshot", "latest"]):
        live = build_live_context()
        if live:
            body = live.split("\n", 1)[1] if "\n" in live else live
            # strip the trailing instruction line meant for the LLM
            body = body.rsplit("When the user asks", 1)[0].strip()
            return "Here's the current snapshot from the database:\n\n" + body

    if any(w in q for w in ["what is", "about", "overview", "explain churn"]):
        return ("**ChurnGuard** is a bank customer churn prediction platform. It uses machine learning to identify "
                "customers at risk of leaving, so analysts can take proactive retention actions.\n\n"
                "It has five main sections: Dashboard, Prediction, Reports, Insights, and Admin Panel.")

    if any(w in q for w in ["predict", "prediction", "run predict", "how to predict"]):
        return ("**How to run a prediction:**\n"
                "1. Go to the **Prediction** page\n"
                "2. Fill in the customer profile (age, tenure, balance, etc.)\n"
                "3. Press **Run Prediction** or hit **Ctrl+Enter**\n\n"
                "You'll see a gauge chart with the churn probability and SHAP bars showing which features drive the risk.")

    if any(w in q for w in ["risk", "high risk", "medium", "low risk", "élevé", "moyen", "faible", "segment"]):
        return ("**Risk levels:**\n"
                "- **High risk** (>70% probability) — Élevé in DB — immediate action needed\n"
                "- **Medium risk** (40–70%) — Moyen — monitor closely\n"
                "- **Low risk** (<40%) — Faible — no immediate action\n\n"
                "Risk is shown as a gauge on the Prediction page, as colored badges in Reports, and in the donut chart on the Dashboard.")

    if any(w in q for w in ["shap", "explain", "feature", "contribution", "why"]):
        return ("**SHAP values** explain *why* a customer got a certain churn probability.\n\n"
                "- **Red bars** → features that increase churn risk\n"
                "- **Green bars** → features that reduce churn risk\n\n"
                "Bars are sorted by impact magnitude so you can see which factors matter most.")

    if any(w in q for w in ["report", "history", "export", "csv", "download"]):
        return ("The **Reports** page shows full prediction history.\n\n"
                "You can:\n"
                "- Filter by risk level (High / Medium / Low)\n"
                "- Export the table to CSV\n"
                "- Upload a CSV for **batch predictions** (Reports → Batch prediction section)")

    if any(w in q for w in ["batch", "upload", "bulk", "multiple"]):
        return ("**Batch predictions:**\n"
                "1. Go to **Reports**\n"
                "2. Scroll to **Batch prediction**\n"
                "3. Upload a CSV with columns: customer_no, account_no, age, tenure, acct_balance, etc.\n"
                "4. Results download automatically as a CSV with churn probabilities and risk levels.")

    if any(w in q for w in ["dashboard", "kpi", "metric", "stat"]):
        return ("The **Dashboard** shows live KPIs:\n"
                "- Total customers · Churn rate · Avg balance · Avg tenure\n"
                "- Predicted churners · High-risk count\n\n"
                "Charts break down churn by age, tenure, balance tier, nationality, KYC score, currency, and industry. "
                "There's also a risk segment donut and a model confusion matrix.")

    if any(w in q for w in ["insight", "recommend", "action", "retention"]):
        return ("The **Insights** page has two sections:\n\n"
                "1. **Charts** — deeper analysis of churn by segment\n"
                "2. **Retention recommendations** — prioritized actions:\n"
                "   - 🎯 Target first-year customers with loyalty rewards\n"
                "   - 📞 7-day personal outreach for High-risk accounts\n"
                "   - 💰 Fee waivers for low-balance accounts\n"
                "   - 📋 Simplify KYC for C/D-score clients")

    if any(w in q for w in ["admin", "user", "role", "permission", "super"]):
        return ("The **Admin Panel** is only accessible to **super_admin** users.\n\n"
                "You can:\n"
                "- Create new user accounts\n"
                "- Edit name, email, phone, department, and role\n"
                "- Deactivate or delete users\n"
                "- Search and filter by name, email, department, or role")

    if any(w in q for w in ["dark", "light", "theme", "mode"]):
        return "Click the **Light / Dark** button in the top-right header to toggle themes. Your preference is saved between sessions."

    if any(w in q for w in ["login", "sign in", "password", "auth"]):
        return ("Login uses email + password. Sessions are JWT-based and expire after 60 minutes.\n\n"
                "If your session expires mid-work, a modal will appear prompting you to sign in again.")

    if any(w in q for w in ["keyboard", "shortcut", "ctrl"]):
        return ("**Keyboard shortcuts:**\n"
                "- **Ctrl+Enter** — Submit the prediction form (Prediction page) or save in Admin modal\n"
                "- **Escape** — Close any open dialog or modal")

    return ("I can help with ChurnGuard topics — predictions, risk levels, reports, the dashboard, insights, and admin.\n\n"
            "Try asking:\n"
            "- *How do I run a prediction?*\n"
            "- *What do risk levels mean?*\n"
            "- *How does batch prediction work?*\n\n"
            "For full AI responses on any question, add `ANTHROPIC_API_KEY=your-key` to the backend `.env` file.")
