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

## Why Raspberry Pi 5?

The Pi 5 (ARM64 Arch Linux) is ideal due to:
+ Low power usage
+ NVMe speed
+ Docker performance
+ Home Lab
+ Enough CPU to run PCA algos in real time
+ Passive cooling possible with ML workloads

A high-performance, containerized, real-time PCA drift-detection system running end-to-end on a Raspberry Pi 5 (Arch ARM).
The platform ingests live Binance data, performs scalable PCA dimensionality reduction, caches results in Redis, and exposes an interactive UI for analyzing PCA drift across components.

## Future Extensions
+ PCA drift alerting
+ Statistical tests (KL divergence, JS divergence)
+ Multi-asset PCA overlays
+ GPU pipeline for Jetson boards
+ On-device model training (autoencoders, VAEs)

## Dynamic PCA Drift-Detection
The frontend visualizes PCA output in an interactive 2D scatter plot, allowing:
+ Cycling between PCA components (PC1 → PC5)

### You can dynamically switch which PCA axes are plotted (PC1 vs PC2, PC2 vs PC3, … PC4 vs PC5), enabling:
+ Cohort drift detection
+ Trend analysis over tme
+ Cluster spread/shift visualization
+ Outlier movement tracking
+ Market regime change detection (crypto volatility)
+ Live updates

### As the ML pipeline writes new PCA points to Redis, the UI fetches and re-renders the scatter plot in real time.
+ Tailwind + React for minimal overhead
+ Optimized for low-latency rendering even on the Pi 5.

## Full System Architecture
     ┌─────────────────────────┐
     │              API        │
     └──────────────┬──────────┘
                    │
                    ▼
     ┌─────────────────────────┐
     │     Data Ingestion      │
     │ (Python + asyncio)      │
     └──────────────┬──────────┘
                    │
                    ▼
     ┌─────────────────────────┐
     │     ML Engine (PCA)     │
     │  Python + sklearn       │
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
