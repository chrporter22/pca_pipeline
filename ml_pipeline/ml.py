import requests
import pandas as pd
import numpy as np
from datetime import datetime
import time
from sklearn.preprocessing import LabelEncoder
import redis
import json
import os
import redis

# Binance US API endpoint
BASE_URL = "https://api.binance.us/api/v3/klines"

# Symbols to fetch
symbols = ["BTCUSDT", "SOLUSDT", "ETHUSDT"]
interval = "1m"
limit = 5000

def fetch_klines(symbol, interval="1m", limit=5000):
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    response = requests.get(BASE_URL, params=params)
    response.raise_for_status()
    data = response.json()

    df = pd.DataFrame(data, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_asset_volume", "number_of_trades",
        "taker_buy_base_asset_volume", "taker_buy_quote_asset_volume", "ignore"
    ])
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    df["close_time"] = pd.to_datetime(df["close_time"], unit="ms")
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df["symbol"] = symbol
    return df[["symbol", "open_time", "open", "high", "low", "close", "volume"]]

def add_zscore_and_flag(df):
    df = df.copy()
    df["zscore_volume"] = (df["volume"] - df["volume"].mean()) / df["volume"].std()
    df["volume_flag"] = df["zscore_volume"].apply(
        lambda z: "above" if z > 1 else "below" if z < -1 else "neutral"
    )
    return df

# Fetch and prepare data
all_data = pd.concat([fetch_klines(symbol, interval, limit) for symbol in symbols], ignore_index=True)
all_data = all_data.groupby("symbol").apply(lambda x: x.sort_values("open_time").tail(5000)).reset_index(drop=True)
all_data = all_data.groupby("symbol").apply(add_zscore_and_flag).reset_index(drop=True)

# Step 1: Convert to datetime
all_data['open_time'] = pd.to_datetime(all_data['open_time'])

# Step 2: Localize to UTC (if naive datetime)
all_data['open_time'] = all_data['open_time'].dt.tz_localize('UTC')

# Step 3: Convert to New York time
all_data['ny_time'] = all_data['open_time'].dt.tz_convert('America/New_York')

# Sort data in descending order
all_data = all_data.sort_values(by='open_time', ascending=False)

all_data = all_data.loc[(all_data['volume_flag'] == 'above')]
print("Large Order Dataframe:", all_data.head(n=10))
print("Size of Dataset:", all_data.shape)

# One-hot encode categorical variables
def preprocess_for_pca(df):
    df = df.copy()

    # Create numeric timestamp from open_time
    df["timestamp"] = df["open_time"].astype(np.int64) // 10**9

    # Label encode categorical columns
    label_encoders = {}
    for col in ["symbol", "volume_flag"]:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        label_encoders[col] = le

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # Filter out unwanted columns (like open_time if needed)
    numeric_cols = [col for col in numeric_cols if col != "open_time"]

    # Create PCA input DataFrame
    df_pca = df[numeric_cols].apply(pd.to_numeric, errors="coerce")

    # Drop rows with NaNs
    before = df_pca.shape[0]
    df_pca = df_pca.dropna()
    after = df_pca.shape[0]

    if after < 2:
        print(f"Insufficient valid rows for PCA: only {after} left after dropping {before - after} rows.")
    else:
        print(f"Ready for PCA: {after} rows, {df_pca.shape[1]} features.")

    # Return PCA input and aligned original DataFrame
    return df_pca, df.loc[df_pca.index]


def compute_pca_from_scratch(X, n_components=5):
    X = np.asarray(X)
    if X.ndim == 1:
        X = X.reshape(-1, 1)

    # Center the data
    X_centered = X - np.mean(X)

    # Covariance matrix
    cov_matrix = np.cov(X_centered, rowvar=False)

    # Eigen decomposition
    eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)

    # Sort by descending eigenvalue
    sorted_idx = np.argsort(eigenvalues)[::-1]
    eigenvalues = eigenvalues[sorted_idx]
    eigenvectors = eigenvectors[:, sorted_idx]

    # Select top components
    components = eigenvectors[:, :n_components]
    explained_variance = eigenvalues[:n_components]

    # Project data
    X_pca = np.dot(X_centered, components)

    return X_pca, explained_variance, components

# List top variance features
def list_top_variance_features(df, top_n=6):
    variances = df.var().sort_values(ascending=False)
    print("\nTop Features by Variance:")
    print(variances.head(top_n))
    return variances.head(top_n)

# Append PCA components to original df
def append_pca_components(df, X_pca, n_components):
    for i in range(n_components):
        df[f'pca_{i+1}'] = X_pca[:, i]
    return df

# Run full pipeline
X, processed_df = preprocess_for_pca(all_data)
list_top_variance_features(X)

if X.shape[0] < 2:
    print("Not enough rows after preprocessing to compute PCA (need at least 2). Exiting.")
    exit()
print(X.head())
print(X.columns)

X = X[[
    'symbol',
    'open',
    'timestamp',
    'volume_flag',
    'zscore_volume',
]]
#
# print(X.head())

X_pca, eigenvalues, components = compute_pca_from_scratch(X.to_numpy(), n_components=5)
processed_df = append_pca_components(all_data, X_pca, n_components=5)

# Show some info
print(processed_df[[col for col in processed_df.columns if col.startswith('pca_')]].head())

print(processed_df.columns)
print(processed_df.head(n=25))

# Connect to Redis (adjust host/port/db as needed)

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)

for _, row in processed_df.iterrows():
    key = f"pca:{row['symbol']}:{int(row['open_time'].timestamp())}"
    value = row.to_dict()
    
    # Convert any datetime or numpy types to native types for JSON serialization
    for k, v in value.items():
        if isinstance(v, (np.integer, np.floating)):
            value[k] = v.item()
        elif isinstance(v, pd.Timestamp):
            value[k] = v.isoformat()
    
    # Store as JSON string
    r.set(key, json.dumps(value))

print("Data written to Redis")
