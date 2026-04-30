# Build context must be the repo root (not backend/).
# Use: docker build -f backend/Dockerfile .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies for PostGIS/GDAL.
# `gettext` is needed by Django's makemessages/compilemessages (i18n .po/.mo).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gdal-bin \
    gettext \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ../requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "GDAL==$(gdal-config --version)"

COPY backend/ /app/

# Compile gettext catalogs (.po -> .mo) so Django can serve them at runtime.
# `|| true` so the build doesn't fail before any catalog has been
# committed; once locale/<lang>/LC_MESSAGES/django.po files exist, this
# bakes their .mo files into the image. Per L4 i18n decision, .mo files
# are NOT committed (build artifact); .po files are source-of-truth.
RUN python manage.py compilemessages || true

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
