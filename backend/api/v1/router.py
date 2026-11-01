"""Composition root for the versioned audience-separated API."""

from fastapi import APIRouter

from routers.chat import me_v1_router as me_chat_router
from routers.feedback import public_v1_router as public_feedback_router
from routers.share import (
    me_v1_router as me_share_router,
    public_v1_router as public_share_router,
)
from routers.telegram import machine_v1_router
from routers.voice import public_v1_router as public_voice_router

router = APIRouter()

public_router = APIRouter()
public_router.include_router(public_voice_router, prefix="/voice", tags=["Public Voice v1"])
public_router.include_router(public_share_router, prefix="/shares", tags=["Public Shares v1"])
public_router.include_router(public_feedback_router, tags=["Public Feedback v1"])

me_router = APIRouter()
me_router.include_router(me_chat_router, tags=["Citizen API v1"])
me_router.include_router(me_share_router, tags=["Citizen API v1"])

machine_router = APIRouter()
machine_router.include_router(machine_v1_router, tags=["Machine API v1"])

router.include_router(public_router, prefix="/public")
router.include_router(me_router, prefix="/me")
router.include_router(machine_router, prefix="/machine")

# Admin and internal route groups are intentionally not mounted. They remain
# blocked until trusted server-side role sources are approved.
