"""Shared admin error types.

These live in a leaf module so both ``admin_service`` and lower-level read
models can raise and translate them without importing each other.
"""

from __future__ import annotations


class AdminUnavailable(RuntimeError):
    """Admin persistence is missing or unreachable; callers return 503."""


class AdminNotFound(RuntimeError):
    """Target resource does not exist."""


class AdminConflict(RuntimeError):
    """The requested transition is not valid for the current state."""


class AdminValidationError(ValueError):
    """Request data failed validation."""
