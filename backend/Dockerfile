# ===========================================================================
# Stage 1 – dependency builder
# ===========================================================================
FROM python:3.11-slim AS builder

# System dependencies required to compile native extensions (asyncpg, cryptography, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libffi-dev \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy and install Python dependencies into an isolated prefix so the
# production stage can copy only the installed packages.
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ===========================================================================
# Stage 2 – production image
# ===========================================================================
FROM python:3.11-slim AS production

LABEL maintainer="PayTrace AI <engineering@paytrace.ai>"
LABEL org.opencontainers.image.description="PayTrace AI – FastAPI backend"

# Minimal runtime system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy installed packages from the builder stage
COPY --from=builder /install /usr/local

# Copy application source
COPY --chown=appuser:appgroup app/ ./app/

USER appuser

# Expose the application port
EXPOSE 8000

# Health-check so Docker / orchestrators can detect application readiness
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command – can be overridden in docker-compose for the worker service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
