"""Composition root for the versioned audience-separated API."""

from fastapi import APIRouter

from routers.chat import me_v1_router as me_chat_router
from routers.admin import router as admin_router
from routers.admin_ingestion import (
    documents_router as admin_ingestion_documents_router,
    router as admin_ingestion_router,
)
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
router.include_router(admin_router, prefix="/admin", tags=["Admin API v1"])
router.include_router(admin_ingestion_router, prefix="/admin/ingestion", tags=["Admin Ingestion v1"])
router.include_router(
    admin_ingestion_documents_router, prefix="/admin/documents", tags=["Admin Ingestion v1"]
)

# Admin routes are mounted but fail closed (503) until a trusted role provider
# is provisioned and the actor has an explicit server-side role.
