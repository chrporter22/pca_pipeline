# Light weight PCA Cohort Drift Detection Pipeline
## Tech Stack
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![Bash](https://img.shields.io/badge/bash_script-%23121011.svg?style=for-the-badge&logo=gnu-bash&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge)
![Nginx](https://img.shields.io/badge/nginx-%23009639.svg?style=for-the-badge&logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/-Raspberry_Pi-C51A4A?style=for-the-badge&logo=Raspberry-Pi)
![Arch Linux](https://img.shields.io/badge/archlinux-%230179DF.svg?style=for-the-badge&logo=arch-linux&logoColor=white)

## Raspberry Pi 5 Home Lab - Quant Research
**Pi 5 (ARM aarch64 linux-rpi) key framework features:**
+ Low power usage
+ NVMe speed
+ Docker performance
+ Home Lab
+ Enough CPU to run PCA algos in real time
+ Passive cooling possible with ML workloads

A high-performance, containerized, real-time PCA drift-detection system running end-to-end on a Raspberry Pi 5 (Arch ARM).
The platform ingests live data, performs scalable PCA dimensionality reduction, caches results in Redis, and exposes an interactive UI for analyzing PCA drift across components.

![Screenshot](/image.png)

## Dynamic PCA Drift-Detection
The frontend visualizes PCA output in an interactive 2D scatter plot, allowing:
+ Cycling between PCA components (PC1 → PC5)
+ Eigen Decomposition and Co-variance analysis via NumPy 

### Dynamically switch which PCA axes, enabling:
+ Cohort drift detection
+ Trend analysis over time
+ Cluster spread/shift visualization
+ Outlier movement tracking
+ Market regime change detection (crypto volatility)
+ Live updates

### ML pipeline writes new PCA points to Redis, UI fetches and re-renders real time.
+ Tailwind + React for minimal overhead
+ Optimized for low-latency rendering even on the Pi 5.

## Production Setup Included
Repository includes a complete production-ready Docker pipeline:
+ Production Features
+ Multi-stage Vite build (optimized static assets)
+ Nginx serving static content
+ Bounded caching & immutable /assets/*
+ Backend /api reverse proxy
+ Redis healthchecks
+ Backend healthchecks
+ Optional cron-style ML schedule
+ Automatic rebuild on git pull

## Full System Architecture
     ┌─────────────────────────┐
     │              API        │
     └──────────────┬──────────┘
                    │
                    ▼
     ┌─────────────────────────┐
     │     Data Ingestion      │
     │          (asyncio)      │
     └──────────────┬──────────┘
                    │
                    ▼
     ┌─────────────────────────┐
     │     ML Engine (PCA)     │
     │  Python + NumPy         │
     └──────────────┬──────────┘
                    │ writes pca:* keys
                    ▼
     ┌─────────────────────────┐
     │       Redis Cache       │
     └──────────────┬──────────┘
                    │
                    ▼
     ┌─────────────────────────┐
     │ Backend (Node + Express)│
     │   /api/pca → JSON       │
     └──────────────┬──────────┘
                    │
                    ▼
     ┌─────────────────────────┐
     │   Frontend UI (React)   │
     │ Dynamic PCA 2D Plot     │
     └──────────────┬──────────┘
                    │
                    ▼
     ┌─────────────────────────┐
     │      Nginx Reverse      │
     │        Proxy            │
     └──────────────┬──────────┘
                    │
                    ▼
     ┌─────────────────────────┐
     │ Raspberry Pi 5 + Docker │
     │ (Arch Linux ARM64)      │
     └─────────────────────────┘

## Future Enhancements
**Data & Feature Engineering Pipeline (PCA/Drift)**
- Model Architecture (Multi-class / Single-layer Neural Net):
- Training + Back-testing Framework (Python)
- Real-time Pipeline (Rust ingestion → C++ ML inference → Redis ↔ Node/React UI)
- UI / Monitoring (2D PCA Drift Plot + Prediction Dashboard)

**Dimension Reduction Algo**
+ PCA drift alerting
+ Statistical tests (KL divergence, JS divergence)
+ Multi-asset PCA overlays
+ On-device model training (autoencoders, multi-nominal log regression probability
  predictions)

**Back Testing Data & Feature Engineering Pipeline**
- Historical Data
- 1 year of options + underlying data from API 
- OHLCV for underlying
- Option chain data (bid/ask/strike/expiration/IV/greeks)
- Risk-free rate (for reference)
- Volume, Open Interest

**Feature Set (14 features across 64 candles → 64×14 tensor)**
- Mean-Reversion Features
    + z-score of price deviation
    + rolling mean / std
    + half-life estimate

- Price-Pairs Features
    + price spread between underlying & synthetic future
    + ratio spread
    + cointegration residual

+ Relative Risk Indexing
    + volatility ratio vs market (VIX / symbol_vol)
    + realized / implied vol ratio
    + ATR normalized

- Derived Option Features
    + delta / gamma / theta / vega
    + moneyness (spot – strike)
    + time to expiry normalized

**Each 64×14 sample → flatten to 896 vector → normalize → PCA(5)**
- Drift Detection
    + Eigenvalue shifts
    + PCA on the first 5 components
    + Wasserstein distance on PCA embedding
    + ADWIN or Kolmogorov drift tests
    + Hotelling’s T² statistic on the 5-component space

**Output**
- 2D scatter of PCA component (PC1 vs PC2)
- Drift score (0–1)
- Flag on timestamps where drift > threshold

**Neural Network Architecture (Multi-class Single-Layer NN)**
Inverse target bands [-1, 0, +1] representing:
- -1: strong put probability (price drop)
- 0: neutral / hold
- +1: strong call probability (price rise)

## System

        Historical Data -------|
                               |--> Python (Feature Gen + PCA + Training + Backtesting)
    Live Exchange → Rust Ingestion → Normalize → Redis (streams/pubsub)
                                          |             
                                          └→ C++ ML Inference (ONNX)
                                                 |
                                                 → Redis: model.predictions
                                                             |
                                                             → Node.js / Express → React UI (PCA drift plot, predictions)
                                                             → Alerts / Logging

