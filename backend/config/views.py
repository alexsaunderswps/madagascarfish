from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


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

    status_code = 200 if db_status == "connected" else 503
    return Response(
        {
            "status": "ok" if status_code == 200 else "degraded",
            "version": "0.1.0",
            "database": db_status,
            "cache": cache_status,
        },
        status=status_code,
    )
