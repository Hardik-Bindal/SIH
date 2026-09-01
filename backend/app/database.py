"""
MongoDB connection module.

Provides a singleton pymongo database client loaded once at startup.
The connection URI is read exclusively from the MONGODB_URI environment
variable — never hardcoded.

Usage:
    from app.database import get_db, mongo_available

    db = get_db()
    if db is not None:
        db["reports"].insert_one(doc)

If MONGODB_URI is not set or the connection fails, get_db() returns None
and the application falls back to the existing in-memory store gracefully.
"""

import logging
import os
from typing import Optional

from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, ConfigurationError

logger = logging.getLogger("sif.database")

_client: Optional[MongoClient] = None
_db = None
_available: bool = False


def _init():
    """Attempt to connect to MongoDB Atlas. Called once at startup."""
    global _client, _db, _available

    uri = os.environ.get("MONGODB_URI", "").strip()
    db_name = os.environ.get("MONGODB_DB_NAME", "sif_sentinel").strip()

    if not uri:
        logger.warning("MONGODB_URI not set — running without MongoDB persistence.")
        return

    if "<db_password>" in uri:
        logger.warning(
            "MONGODB_URI still contains the placeholder '<db_password>'. "
            "Replace it with the real password in backend/.env — "
            "running without MongoDB persistence for now."
        )
        return

    try:
        # serverSelectionTimeoutMS keeps startup fast if Atlas is unreachable
        _client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        # Ping to verify the connection is live
        _client.admin.command("ping")
        _db = _client[db_name]
        _available = True
        _ensure_indexes()
        logger.info(
            "MongoDB connected — database: %s", db_name
        )
    except (ConnectionFailure, ConfigurationError) as exc:
        logger.error(
            "MongoDB connection failed (%s) — running in memory-only mode. "
            "Live submissions will not persist across restarts.",
            type(exc).__name__,
        )
        _client = None
        _db = None
        _available = False


def _ensure_indexes():
    """Create indexes for the reports collection (idempotent)."""
    if _db is None:
        return
    col = _db["reports"]
    col.create_index([("report_id", ASCENDING)], unique=True, name="report_id_unique")
    col.create_index([("risk_band", ASCENDING)], name="risk_band")
    col.create_index([("site", ASCENDING)], name="site")
    col.create_index([("department", ASCENDING)], name="department")
    col.create_index([("reported_on", ASCENDING)], name="reported_on")
    col.create_index([("source", ASCENDING)], name="source")
    logger.debug("MongoDB indexes verified.")


def get_db():
    """Return the pymongo Database instance, or None if unavailable."""
    return _db


def mongo_available() -> bool:
    """True if the MongoDB connection is alive."""
    return _available


# Initialise on import so any import of this module triggers the connection.
_init()
