import asyncio
import aiohttp
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.preprocessing import LabelEncoder
import redis
import json
import os
import time

# =========================
# CONFIG
# =========================
BASE_URL = "https://api.binance.us/api/v3/klines"
symbols = ["BTCUSDT", "SOLUSDT", "ETHUSDT"]
interval = "1m"
limit = 5000
LOOP_SLEEP_SECONDS = 60  # run once per minute

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_MAX_ITEMS = 1000

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)

# =========================
# ASYNC FETCH
# =========================
async def fetch_klines(session, symbol):
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    async with session.get(BASE_URL, params=params, timeout=10) as resp:
        resp.raise_for_status()
        data = await resp.json()

    df = pd.DataFrame(data, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_asset_volume", "number_of_trades",
        "taker_buy_base_asset_volume", "taker_buy_quote_asset_volume", "ignore"
    ])

    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["symbol"] = symbol
    return df[["symbol", "open_time", "open", "high", "low", "close", "volume"]]

# =========================
# FEATURE ENGINEERING
# =========================
def add_zscore_and_flag(df):
    df = df.copy()
    df["zscore_volume"] = (df["volume"] - df["volume"].mean()) / df["volume"].std()
    df["volume_flag"] = df["zscore_volume"].apply(
        lambda z: "above" if z > 1 else "below" if z < -1 else "neutral"
    )
    return df

def preprocess_for_pca(df):
    df = df.copy()
    df["timestamp"] = df["open_time"].astype(np.int64) // 10**9

    for col in ["symbol", "volume_flag"]:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))

    numeric_cols = df.select_dtypes(include=[np.number]).columns
    X = df[numeric_cols].dropna()

    return X, df.loc[X.index]

def compute_pca_from_scratch(X, n_components=5):
    X = np.asarray(X)
    X_centered = X - np.mean(X, axis=0)
    cov_matrix = np.cov(X_centered, rowvar=False)
    eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)
    idx = np.argsort(eigenvalues)[::-1]
    components = eigenvectors[:, idx][:, :n_components]
    X_pca = X_centered @ components
    return X_pca

def append_pca_components(df, X_pca):
    for i in range(X_pca.shape[1]):
        df[f"pca_{i+1}"] = X_pca[:, i]
    return df

# =========================
# REDIS WRITE (1000 MAX)
# =========================
def write_to_redis(df):
    pipe = r.pipeline(transaction=False)

    for _, row in df.iterrows():
        ts = int(row["open_time"].timestamp())
        key = f"pca:{row['symbol']}"

        payload = {}
        for k, v in row.to_dict().items():
            if isinstance(v, (np.integer, np.floating)):
                payload[k] = v.item()
            elif isinstance(v, pd.Timestamp):
                payload[k] = v.isoformat()
            else:
                payload[k] = v

        pipe.zadd(key, {json.dumps(payload): ts})
        pipe.zremrangebyrank(key, 0, -REDIS_MAX_ITEMS - 1)

    pipe.execute()

# =========================
# MAIN LOOP
# =========================
async def main_loop():
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                tasks = [fetch_klines(session, s) for s in symbols]
                dfs = await asyncio.gather(*tasks)

                all_data = pd.concat(dfs, ignore_index=True)
                all_data = (
                    all_data
                    .groupby("symbol")
                    .apply(lambda x: x.sort_values("open_time").tail(5000))
                    .reset_index(drop=True)
                )

                all_data = (
                    all_data
                    .groupby("symbol")
                    .apply(add_zscore_and_flag)
                    .reset_index(drop=True)
                )

                all_data = all_data[all_data["volume_flag"] == "above"]

                if len(all_data) < 2:
                    print("Not enough data for PCA, skipping iteration")
                    await asyncio.sleep(LOOP_SLEEP_SECONDS)
                    continue

                X, processed_df = preprocess_for_pca(all_data)
                X = X[["symbol", "open", "timestamp", "volume_flag", "zscore_volume"]]

                X_pca = compute_pca_from_scratch(X.to_numpy(), n_components=5)
                processed_df = append_pca_components(processed_df, X_pca)

                write_to_redis(processed_df)

                print(f"[{datetime.utcnow().isoformat()}] Updated Redis")

            except Exception as e:
                print("Loop error:", e)

            await asyncio.sleep(LOOP_SLEEP_SECONDS)

# =========================
# ENTRYPOINT
# =========================
if __name__ == "__main__":
    asyncio.run(main_loop())

