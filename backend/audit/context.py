"""Thread-local audit actor context.

Signal handlers (see ``audit.signals``) consult this context to determine
who is attributed for a given save. Code paths that modify audited fields
should wrap the critical section in ``audit_actor(...)``; anything saved
outside a context is recorded with ``actor_system="unknown"`` so policy
violations are searchable per BA Req 3a.
"""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from integration.models import SyncJob


@dataclass
class ActorContext:
    user: Any = None
    system: str = ""
    sync_job: SyncJob | None = None
    reason: str = ""
    extras: dict[str, Any] = field(default_factory=dict)


_state = threading.local()


def current_actor() -> ActorContext | None:
    """Return the innermost ActorContext, or None if no context is active."""
    stack = getattr(_state, "stack", None)
    if not stack:
        return None
    return stack[-1]


@contextmanager
def audit_actor(
    *,
    user: Any = None,
    system: str = "",
    sync_job: SyncJob | None = None,
    reason: str = "",
    **extras: Any,
) -> Iterator[ActorContext]:
    """Scope an audit-actor attribution for the duration of a block.

    Nested contexts stack; the innermost wins. Thread-local state is always
    popped on exit, even on exception, so retry-heavy Celery workers don't
    leak attribution across tasks.
    """
    if not user and not system:
        raise ValueError("audit_actor requires either `user` or `system` to be set.")
    ctx = ActorContext(user=user, system=system, sync_job=sync_job, reason=reason, extras=extras)
    stack = getattr(_state, "stack", None)
    if stack is None:
        stack = []
        _state.stack = stack
    stack.append(ctx)
    try:
        yield ctx
    finally:
        stack.pop()
