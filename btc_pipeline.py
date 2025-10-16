import requests
import pandas as pd
import numpy as np
from datetime import datetime
import time
from sklearn.preprocessing import LabelEncoder
import redis
import json

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

    # Optional: Rename encoded columns if needed (e.g., symbol -> symbol_label)
    # df.rename(columns={"symbol": "symbol_label", "volume_flag": "volume_flag_label"}, inplace=True)

    # Select only numeric columns (final output will be all numeric)
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

# def preprocess_for_pca(df):
#     df = df.copy()
#
#     # Create numeric timestamp
#     df["timestamp"] = df["open_time"].astype(np.int64) // 10**9
#
#     # Label encode original categorical columns
#     label_encoders = {}
#     for col in ["symbol", "volume_flag"]:
#         le = LabelEncoder()
#         df[f"{col}_label"] = le.fit_transform(df[col].astype(str))
#         label_encoders[col] = le
#
#     # One-hot encode categorical variables (keep column names)
#     df_encoded = pd.get_dummies(df, columns=["symbol", "volume_flag"], drop_first=False)
#
#     # Define features for PCA input: only numeric
#     features = (
#         ["open", "timestamp", "zscore_volume", "symbol_label", "volume_flag_label"] +
#         [col for col in df_encoded.columns if col.startswith("symbol_") or col.startswith("volume_flag_")]
#     )
#
#     # Final numeric DataFrame for PCA
#     df_pca = df_encoded[features].apply(pd.to_numeric, errors="coerce")
#
#     # Drop rows with NaNs
#     before = df_pca.shape[0]
#     df_pca = df_pca.dropna()
#     after = df_pca.shape[0]
#
#     if after < 2:
#         print(f"Insufficient valid rows for PCA: only {after} left after dropping {before - after} rows.")
#     else:
#         print(f"Ready for PCA: {after} rows, {df_pca.shape[1]} features.")
#
#     # Return PCA input and aligned full DataFrame with all labels
#     return df_pca, df.loc[df_pca.index]

# def preprocess_for_pca(df):
#     df = df.copy()
#     df["timestamp"] = df["open_time"].astype(np.int64) // 10**9
#     df = pd.get_dummies(df, columns=["symbol", "volume_flag"], drop_first=True)
#
#     features = ["open", "timestamp", "zscore_volume"] + \
#                [col for col in df.columns if col.startswith("symbol_") or col.startswith("volume_flag_")]
#
#     df_pca = df[features].apply(pd.to_numeric, errors="coerce")
#     before = df_pca.shape[0]
#     df_pca = df_pca.dropna()
#     after = df_pca.shape[0]
#
#     if after < 2:
#         print(f"Insufficient valid rows for PCA: only {after} left after dropping {before - after} rows.")
#     else:
#         print(f"Ready for PCA: {after} rows, {df_pca.shape[1]} features.")
#
#     return df_pca, df.loc[df_pca.index]

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
#
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

# ASCII 2D PCA Plot
def plot_pca_ascii(df, comp_x=1, comp_y=2, width=80, height=20):
    x = df[f'pca_{comp_x}']
    y = df[f'pca_{comp_y}']
    x_scaled = ((x - x.min()) / (x.max() - x.min()) * (width - 1)).astype(int)
    y_scaled = ((y - y.min()) / (y.max() - y.min()) * (height - 1)).astype(int)

    canvas = [[" " for _ in range(width)] for _ in range(height)]

    for xi, yi in zip(x_scaled, y_scaled):
        canvas[height - 1 - yi][xi] = "*"

    print(f"\nASCII PCA Plot (pca_{comp_x} vs pca_{comp_y}):")
    for row in canvas:
        print("".join(row))

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

# ANSI color codes
ANSI_COLORS = [
    '\033[91m',  # Red
    '\033[92m',  # Green
    '\033[93m',  # Yellow
    '\033[94m',  # Blue
    '\033[95m',  # Magenta
    '\033[96m',  # Cyan
    '\033[97m',  # White
]
ANSI_RESET = '\033[0m'

def plot_pca_ascii_colored(df, comp_x=1, comp_y=2, cluster_by=None, width=80, height=20):
    x = df[f'pca_{comp_x}']
    y = df[f'pca_{comp_y}']
    x_scaled = ((x - x.min()) / (x.max() - x.min()) * (width - 1)).astype(int)
    y_scaled = ((y - y.min()) / (y.max() - y.min()) * (height - 1)).astype(int)

    canvas = [[" " for _ in range(width)] for _ in range(height)]

    # Handle clustering color
    if cluster_by and cluster_by in df.columns:
        unique_clusters = sorted(df[cluster_by].unique())
        color_map = {val: ANSI_COLORS[i % len(ANSI_COLORS)] for i, val in enumerate(unique_clusters)}
    else:
        cluster_by = None
        color_map = {}

    # Plot each point
    for xi, yi, cluster_val in zip(x_scaled, y_scaled, df[cluster_by] if cluster_by else [""] * len(x_scaled)):
        symbol = "*"
        color = color_map.get(cluster_val, "") if cluster_by else ""
        canvas[height - 1 - yi][xi] = f"{color}{symbol}{ANSI_RESET}" if color else symbol

    # Print canvas
    print(f"\nASCII PCA Plot (pca_{comp_x} vs pca_{comp_y})" + (f" - Colored by '{cluster_by}'" if cluster_by else ""))
    for row in canvas:
        print("".join(row))

def cycle_ascii_plots_colored(df, cluster_vars=["volume_flag", "symbol"]):
    for cluster_by in cluster_vars:
        for i in range(1, 4):  # PCA pairs (1 vs 2), (2 vs 3), ...
            plot_pca_ascii_colored(df, comp_x=i, comp_y=i+1, cluster_by=cluster_by)
            input(f"Press Enter to continue (Next: PCA comp or cluster '{cluster_by}')...")

# Show some info
print(processed_df[[col for col in processed_df.columns if col.startswith('pca_')]].head())

import matplotlib.pyplot as plt

def save_pca_scatter_plot(df, comp_x=1, comp_y=2, color_col="volume_flag_label", output_file="pca_scatter.png"):
    x = df[f"pca_{comp_x}"]
    y = df[f"pca_{comp_y}"]
    colors = df[color_col]

    plt.figure(figsize=(10, 6))
    scatter = plt.scatter(x, y, c=colors, cmap="viridis", edgecolor='k', alpha=0.8)

    cbar = plt.colorbar(scatter)
    cbar.set_label(color_col)

    plt.xlabel(f"PCA Component {comp_x}")
    plt.ylabel(f"PCA Component {comp_y}")
    plt.title(f"PCA Scatter Plot: Component {comp_x} vs {comp_y}")
    plt.grid(True)

    plt.tight_layout()
    plt.savefig(output_file, dpi=300)
    plt.close()

    print(f"Saved PCA scatter plot as: {output_file}")

save_pca_scatter_plot(processed_df, comp_x=2, comp_y=3, color_col="zscore_volume", output_file="pca_volume_flag.png")

# Optional: Cycle through ASCII plots
cycle_ascii_plots_colored(processed_df)

print(processed_df.columns)
print(processed_df.head(n=25))

# Connect to Redis (adjust host/port/db as needed)
r = redis.Redis(host='localhost', port=6379, db=0)

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
