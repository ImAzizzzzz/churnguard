"""
Rebuild the churn model + preprocessing artifacts from the PostgreSQL
`clients_clean` table, faithfully replicating Notebook 2 (encoding /
normalisation) and Notebook 3 (tree-based feature selection + Random Forest).

Outputs into backend/ml/:
    model.joblib, scaler.joblib, encoded_columns.json,
    selected_features.json, scaled_columns.json
"""
import os, json, time
import pandas as pd
import joblib
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

from database import engine

ML_DIR = os.path.join(os.path.dirname(__file__), "ml")
os.makedirs(ML_DIR, exist_ok=True)

t0 = time.time()
print("Loading clients_clean from PostgreSQL …")
df = pd.read_sql("SELECT * FROM clients_clean", engine)
df.columns = df.columns.str.strip().str.upper()
print("Loaded:", df.shape)

# Drop derived helper columns the notebook never used
df = df.drop(columns=["RESIDENCE_GROUPED", "NATIONALITY_GROUPED"], errors="ignore")

# ── Notebook 2: numeric / categorical split ────────────────────────────────
num_cols = ["AGE", "TENURE", "ACCT_BALANCE"]
cat_cols = ["LOB", "INDUSTRY", "NATIONALITY", "RESIDENCE", "PARTYCLASS", "BRANCH",
            "SCORE_KYC", "NATURE_CLIENT", "MARITAL_STATUS", "ACCOUNT_CATEGORY",
            "CURRENCY", "ACCOUNTNATURE"]
num_cols = [c for c in num_cols if c in df.columns]
cat_cols = [c for c in cat_cols if c in df.columns]

df["AGE"] = pd.to_numeric(df["AGE"], errors="coerce").fillna(0).astype(int)
df["TENURE"] = pd.to_numeric(df["TENURE"], errors="coerce").fillna(0).astype(int)
df["ACCT_BALANCE"] = pd.to_numeric(df["ACCT_BALANCE"], errors="coerce")

# KYC ordinal
KYC = {"LR": 1, "MR": 2, "H1": 3, "H2": 4, "H3": 5}
df["SCORE_KYC"] = df["SCORE_KYC"].map(KYC)
num_cols.append("SCORE_KYC")
cat_cols.remove("SCORE_KYC")

df_num = df[num_cols].copy()
df_cat = df[cat_cols].copy()
df_target = df[["CHURN"]].copy()

# Codes → string
for col in ["LOB", "INDUSTRY", "BRANCH", "ACCOUNT_CATEGORY"]:
    if col in df_cat.columns:
        df_cat[col] = df_cat[col].astype(str)


def group_top(data, col, n):
    top = data[col].value_counts().nlargest(n).index
    data[col] = data[col].apply(lambda x: x if x in top else "OTHER")
    return data


for col in ["BRANCH", "INDUSTRY", "ACCOUNT_CATEGORY", "ACCOUNTNATURE"]:
    if col in df_cat.columns:
        df_cat = group_top(df_cat, col, 5)

for col, n in {"RESIDENCE": 3, "NATIONALITY": 3, "CURRENCY": 3, "LOB": 3,
               "NATURE_CLIENT": 4, "PARTYCLASS": 4, "MARITAL_STATUS": 3}.items():
    if col in df_cat.columns:
        df_cat = group_top(df_cat, col, n)

df_cat_encoded = pd.get_dummies(df_cat, drop_first=True).astype(int)

df_final = pd.concat([df_num.reset_index(drop=True),
                      df_cat_encoded.reset_index(drop=True),
                      df_target.reset_index(drop=True)], axis=1)

# MinMax on the 4 numerics
scaled_columns = [c for c in ["AGE", "TENURE", "ACCT_BALANCE", "SCORE_KYC"] if c in df_final.columns]
scaler = MinMaxScaler()
df_final[scaled_columns] = scaler.fit_transform(df_final[scaled_columns])

df_final["CHURN"] = pd.to_numeric(df_final["CHURN"], errors="coerce").fillna(0).astype(int)
df_final = df_final.fillna(0)   # safety — RF cannot take NaN

# ── Notebook 3: split + feature selection + final model ────────────────────
y = df_final["CHURN"]
X = df_final.drop(columns=["CHURN"])
print("X:", X.shape, "| churn rate:", round(y.mean() * 100, 1), "%")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

print("Fitting selector RandomForest (200 trees)…")
selector = RandomForestClassifier(n_estimators=200, random_state=42,
                                  class_weight="balanced", n_jobs=-1)
selector.fit(X_train, y_train)

imp = pd.DataFrame({"f": X.columns, "i": selector.feature_importances_}).sort_values("i", ascending=False)
selected_features = list(imp.head(30)["f"].values)
print("Top features:", selected_features[:8], "…")

print("Fitting final RandomForest on 30 features…")
# Depth / leaf limits keep the saved model compact (~MB instead of ~1GB)
# while preserving accuracy — important for a deployable API model.
final_model = RandomForestClassifier(
    n_estimators=120, max_depth=14, min_samples_leaf=50,
    random_state=42, class_weight="balanced", n_jobs=-1)
final_model.fit(X_train[selected_features], y_train)

# quick test metric
from sklearn.metrics import roc_auc_score, accuracy_score
proba_test = final_model.predict_proba(X_test[selected_features])[:, 1]
print("Test AUC:", round(roc_auc_score(y_test, proba_test), 4),
      "| Acc:", round(accuracy_score(y_test, (proba_test >= 0.5).astype(int)), 4))

# ── Save artifacts ─────────────────────────────────────────────────────────
joblib.dump(final_model, os.path.join(ML_DIR, "model.joblib"))
joblib.dump(scaler, os.path.join(ML_DIR, "scaler.joblib"))
json.dump([str(c) for c in X.columns], open(os.path.join(ML_DIR, "encoded_columns.json"), "w"))
json.dump([str(c) for c in selected_features], open(os.path.join(ML_DIR, "selected_features.json"), "w"))
json.dump(scaled_columns, open(os.path.join(ML_DIR, "scaled_columns.json"), "w"))

print(f"\nSaved 5 artifacts to {ML_DIR}")
print(f"Done in {round(time.time() - t0)}s")
