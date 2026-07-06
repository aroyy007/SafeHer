"""
SafeHer Backend — Custom Exceptions & Global Error Handlers
=============================================================
Safety-critical design: NO endpoint should ever return a raw 500 error.
Every failure path returns a helpful message with emergency contact info.
A frightened user seeing "Internal Server Error" is unacceptable.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger("safeher.exceptions")


# --- Custom Exception Classes ---

class GraphNotLoadedError(Exception):
    """Raised when the OSM graph hasn't finished loading at startup."""
    pass


class OutOfBoundsError(Exception):
    """Raised when coordinates fall outside Bangladesh / Chittagong bounds."""
    def __init__(self, message: str = "Coordinates are outside the supported area."):
        self.message = message
        super().__init__(self.message)


class NoPathFoundError(Exception):
    """Raised when no walkable path exists between two points."""
    def __init__(self, message: str = "No walkable path found between these points."):
        self.message = message
        super().__init__(self.message)


class RateLimitExceededError(Exception):
    """Raised when a user exceeds the allowed request rate."""
    def __init__(self, message: str = "Too many requests. Please try again later."):
        self.message = message
        super().__init__(self.message)


class KnowledgeBaseEmptyError(Exception):
    """Raised when ChromaDB has no documents (hasn't been seeded)."""
    pass


# --- Emergency Fallback Response ---

EMERGENCY_FALLBACK = {
    "reply": (
        "দুঃখিত, এখন সাহায্য করতে পারছি না। এখনই ৯৯৯ কল করুন।\n"
        "Sorry, I can't help right now. Call 999 immediately.\n"
        "নারী ও শিশু নির্যাতন প্রতিরোধ হেল্পলাইন: ১০৯২১"
    ),
    "lang_detected": "unknown",
    "was_transliterated": False,
    "fallback_used": True,
}


# --- Global Exception Handlers ---

async def graph_not_loaded_handler(request: Request, exc: GraphNotLoadedError):
    """503 — server is still starting up."""
    logger.warning("Graph not loaded yet — request rejected")
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Server is still starting up. The road network is loading. Please retry in 10 seconds.",
            "retry_after_seconds": 10,
        },
        headers={"Retry-After": "10"},
    )


async def out_of_bounds_handler(request: Request, exc: OutOfBoundsError):
    """422 — coordinates outside Bangladesh."""
    return JSONResponse(
        status_code=422,
        content={"detail": exc.message},
    )


async def no_path_handler(request: Request, exc: NoPathFoundError):
    """404 — no walkable route exists."""
    return JSONResponse(
        status_code=404,
        content={
            "detail": exc.message,
            "suggestion": "Try coordinates closer to main roads. The area may be separated by a river or highway.",
        },
    )


async def rate_limit_handler(request: Request, exc: RateLimitExceededError):
    """429 — too many requests."""
    return JSONResponse(
        status_code=429,
        content={"detail": exc.message},
        headers={"Retry-After": "60"},
    )


async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unhandled exceptions.
    NEVER return a raw traceback to the user.
    Always include emergency contact info.
    """
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)

    # If this was a chat-related endpoint, return emergency fallback
    if "/chat" in str(request.url.path):
        return JSONResponse(status_code=200, content=EMERGENCY_FALLBACK)

    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred. If you need help now, call 999.",
            "emergency": "জরুরী সাহায্যের জন্য ৯৯৯ কল করুন।",
        },
    )


def register_exception_handlers(app):
    """Register all custom exception handlers on the FastAPI app."""
    app.add_exception_handler(GraphNotLoadedError, graph_not_loaded_handler)
    app.add_exception_handler(OutOfBoundsError, out_of_bounds_handler)
    app.add_exception_handler(NoPathFoundError, no_path_handler)
    app.add_exception_handler(RateLimitExceededError, rate_limit_handler)
    app.add_exception_handler(Exception, global_exception_handler)
