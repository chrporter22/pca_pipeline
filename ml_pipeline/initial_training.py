import json
import redis
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from tensorflow.keras.utils import to_categorical
import random

# =========================
# CONFIG
# =========================
REDIS_URL = "redis://localhost:6379"
SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
BASE_SYMBOL = "BTCUSDT"

WINDOW = 600
DRIFT_WINDOW = 50
PAIR_WINDOW = 50
FUTURE_HORIZON = 5

RET_TH = 0.002
PRICE_Z_TH = 1.0
DRIFT_TH = 1.5
VOL_Z_TH = 2.0
PAIR_Z_TH = 1.5

RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30

N_RANDOM_SEARCH = 10

MODEL_OUT = "pca_pair_regime_multisymbol_onehot_best.tflite"

# =========================
# LOAD REDIS
# =========================
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
dfs = []

for sym in SYMBOLS:
    raw = r.zrange(f"pca:{sym}", -WINDOW, -1)
    rows = [json.loads(x) for x in raw]
    df = pd.DataFrame(rows)
    df["symbol"] = sym
    df = df.sort_values("timestamp")
    dfs.append(df)

df = pd.concat(dfs)

# =========================
# ALIGN SYMBOLS BY TIMESTAMP
# =========================
df = df.pivot_table(
    index="timestamp",
    columns="symbol",
    values=[
        "close",
        "pca_1", "pca_2", "pca_3",
        "zscore_volume"
    ]
)

df.columns = ["_".join(col) for col in df.columns]
df = df.dropna().reset_index()

# =========================
# FEATURE ENGINEERING
# =========================
def rsi(series, period=14):
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = -delta.clip(upper=0).rolling(period).mean()
    rs = gain / (loss + 1e-8)
    return 100 - (100 / (1 + rs))

for sym in SYMBOLS:
    df[f"rsi_{sym}"] = rsi(df[f"close_{sym}"])
    df[f"rsi_slope_{sym}"] = df[f"rsi_{sym}"].diff()

    mean = df[f"close_{sym}"].rolling(WINDOW).mean()
    std = df[f"close_{sym}"].rolling(WINDOW).std()
    df[f"price_z_{sym}"] = (df[f"close_{sym}"] - mean) / (std + 1e-8)

    pca = df[[f"pca_1_{sym}", f"pca_2_{sym}", f"pca_3_{sym}"]]
    pca_mean = pca.rolling(DRIFT_WINDOW).mean()
    df[f"pca_drift_{sym}"] = np.linalg.norm(pca - pca_mean, axis=1)

# =========================
# PRICE PAIR FEATURES
# =========================
for sym in SYMBOLS:
    if sym == BASE_SYMBOL:
        continue
    spread = df[f"close_{sym}"] / df[f"close_{BASE_SYMBOL}"]
    mean = spread.rolling(PAIR_WINDOW).mean()
    std = spread.rolling(PAIR_WINDOW).std()
    df[f"pair_z_{sym}"] = (spread - mean) / (std + 1e-8)

# =========================
# FUTURE RETURNS
# =========================
for sym in SYMBOLS:
    df[f"future_ret_{sym}"] = (
        df[f"close_{sym}"].shift(-FUTURE_HORIZON) - df[f"close_{sym}"]
    ) / df[f"close_{sym}"]

df = df.dropna().reset_index(drop=True)

# =========================
# TARGET CURATION
# =========================
def curate_target(row, sym):
    if row[f"pca_drift_{sym}"] > DRIFT_TH:
        if row[f"future_ret_{sym}"] < -RET_TH:
            return 1  # SELL
        return 2      # HOLD

    if sym != BASE_SYMBOL and abs(row.get(f"pair_z_{sym}", 0)) > PAIR_Z_TH:
        return 1 if row[f"pair_z_{sym}"] > 0 else 0

    if (
        row[f"price_z_{sym}"] < -PRICE_Z_TH and
        row[f"rsi_{sym}"] < RSI_OVERSOLD and
        row[f"rsi_slope_{sym}"] > 0 and
        row[f"zscore_volume_{sym}"] > 0 and
        row[f"future_ret_{sym}"] > RET_TH
    ):
        return 0

    if (
        row[f"price_z_{sym}"] > PRICE_Z_TH and
        row[f"rsi_{sym}"] > RSI_OVERBOUGHT and
        row[f"rsi_slope_{sym}"] < 0 and
        row[f"zscore_volume_{sym}"] > 0 and
        row[f"future_ret_{sym}"] < -RET_TH
    ):
        return 1

    return 2

# =========================
# BUILD TRAINING SET
# =========================
rows = []

for sym_id, sym in enumerate(SYMBOLS):
    for _, r in df.iterrows():
        rows.append({
            "symbol_id": sym_id,
            "target": curate_target(r, sym),
            "features": [
                r[f"pca_1_{sym}"],
                r[f"pca_2_{sym}"],
                r[f"pca_3_{sym}"],
                r[f"pca_drift_{sym}"],
                r[f"price_z_{sym}"],
                r[f"rsi_{sym}"],
                r[f"rsi_slope_{sym}"],
                r[f"zscore_volume_{sym}"],
                r.get(f"pair_z_{sym}", 0.0),
            ]
        })

train_df = pd.DataFrame(rows)

X = np.vstack(train_df["features"].values)
y = train_df["target"].values

# =========================
# ONE-HOT ENCODE TARGET
# =========================
y_onehot = to_categorical(y, num_classes=3)

# =========================
# SCALE FEATURES
# =========================
scaler = StandardScaler()
X = scaler.fit_transform(X)

np.save("scaler_mean.npy", scaler.mean_)
np.save("scaler_scale.npy", scaler.scale_)

# =========================
# TRAIN-VALIDATION SPLIT
# =========================
X_train, X_val, y_train, y_val = train_test_split(
    X, y_onehot, test_size=0.2, random_state=42, stratify=y
)

# =========================
# RANDOM SEARCH HYPERPARAMS
# =========================
search_space = {
    "lr": [0.001, 0.005, 0.01, 0.02],
    "batch_size": [64, 128, 256],
    "epochs": [30, 60, 100]
}

best_val_acc = 0
best_model = None
best_hparams = None

for i in range(N_RANDOM_SEARCH):
    lr = random.choice(search_space["lr"])
    batch_size = random.choice(search_space["batch_size"])
    epochs = random.choice(search_space["epochs"])

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(X.shape[1],)),
        tf.keras.layers.Dense(3, activation="softmax")
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=lr),
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        batch_size=batch_size,
        epochs=epochs,
        verbose=0
    )

    val_acc = history.history["val_accuracy"][-1]
    print(f"[{i+1}/{N_RANDOM_SEARCH}] lr={lr}, batch={batch_size}, epochs={epochs}, val_acc={val_acc:.4f}")

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        best_model = model
        best_hparams = {"lr": lr, "batch_size": batch_size, "epochs": epochs}

# =========================
# EXPORT BEST MODEL
# =========================
converter = tf.lite.TFLiteConverter.from_keras_model(best_model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()

with open(MODEL_OUT, "wb") as f:
    f.write(tflite_model)

print("✅ Exported best model:", MODEL_OUT)
print("Best hyperparameters:", best_hparams)
