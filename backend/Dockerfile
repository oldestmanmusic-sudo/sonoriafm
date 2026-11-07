# SonoriaFM Backend - Deno + Drizzle + PostgreSQL
FROM denoland/deno:2.1.0

# Install postgres client for migrations
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first (for caching)
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno install --entrypoint deno.json

# Copy source code
COPY src ./src
COPY migrations ./migrations

# Create non-root user
RUN addgroup --system --gid 1001 deno \
    && adduser --system --uid 1001 --gid 1001 deno \
    && chown -R deno:deno /app

USER deno

# Expose port
EXPOSE 8000

# Run migrations then start server
CMD ["sh", "-c", "deno run --allow-all migrations/run.ts && deno run --allow-all src/main.ts"]