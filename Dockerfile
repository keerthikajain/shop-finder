FROM node:22-bookworm-slim AS web
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 SHOP_FINDER_DB=/data/shop_finder.sqlite3 SHOP_FINDER_SERVE_WEB=true PORT=8080
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && useradd --uid 10001 --create-home appuser && mkdir /data && chown appuser /data
COPY backend/app ./backend/app
COPY data ./data
COPY scripts/create_owner.py scripts/serve.py scripts/backup_database.py ./scripts/
COPY --from=web /build/frontend/dist ./frontend/dist
USER appuser
EXPOSE 8080
CMD ["python","scripts/serve.py"]
