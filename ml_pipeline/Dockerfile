FROM python:3.11-slim

# Set exact version and architecture
ENV UV_VERSION="0.1.17"
ENV UV_ARCH="aarch64-unknown-linux-musl"
ENV UV_FILENAME="uv-${UV_VERSION}-${UV_ARCH}.tar.gz"

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install uv binary directly
RUN curl -L "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${UV_FILENAME}" \
    -o /tmp/uv.tar.gz && \
    mkdir -p /tmp/uv && \
    tar -xzf /tmp/uv.tar.gz -C /tmp/uv && \
    mv /tmp/uv/uv /usr/local/bin/uv && \
    chmod +x /usr/local/bin/uv && \
    rm -rf /tmp/uv /tmp/uv.tar.gz

# Confirm uv works
RUN which uv && uv --version

WORKDIR /app

# Copy dependencies and compile lock file
COPY requirements.txt .
RUN uv pip compile requirements.txt --output-file requirements.lock.txt

# Copy the rest of the app
COPY ml.py .
COPY run.sh .

# Create venv and install requirements
RUN uv venv .venv && \
    .venv/bin/uv pip install -r requirements.lock.txt

RUN chmod +x ./run.sh

CMD ["./run.sh"]

