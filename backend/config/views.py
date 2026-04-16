from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from config.celery import app as celery_app


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request: Request) -> Response:
    db_status = "connected"
    try:
        connection.ensure_connection()
    except Exception:
        db_status = "error"

    cache_status = "connected"
    try:
        cache.set("_health_check", "ok", timeout=5)
        if cache.get("_health_check") != "ok":
            cache_status = "error"
    except Exception:
        cache_status = "error"

    celery_status = "connected"
    try:
        replies = celery_app.control.ping(timeout=1)
        if not replies:
            celery_status = "error"
    except Exception:
        celery_status = "error"

    healthy = (
        db_status == "connected"
        and cache_status == "connected"
        and celery_status == "connected"
    )
    status_code = 200 if healthy else 503
    return Response(
        {
            "status": "ok" if healthy else "degraded",
            "version": "0.1.0",
            "database": db_status,
            "cache": cache_status,
            "celery": celery_status,
        },
        status=status_code,
    )
