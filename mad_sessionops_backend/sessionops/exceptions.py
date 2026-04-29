"""
Typed exceptions for sessionops.

Services raise these; Ninja exception handlers map them to HTTP responses.
"""


class AuthenticationError(Exception):
    """Raised when authentication fails for any reason.

    error_code is a machine-readable string for the frontend.
    message is the human-readable explanation (never leak internal details to clients).
    """

    def __init__(self, message: str, error_code: str = "AUTH_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class PermissionDenied(Exception):
    """Raised when an authenticated user lacks the required role or scope."""

    def __init__(self, message: str = "Permission denied.", error_code: str = "PERMISSION_DENIED"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class NotFound(Exception):
    """Raised when a requested resource does not exist."""

    def __init__(self, message: str = "Not found.", error_code: str = "NOT_FOUND"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class ConflictError(Exception):
    """Raised when a write operation conflicts with existing state (e.g. duplicate)."""

    def __init__(self, message: str, error_code: str = "CONFLICT"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class ValidationError(Exception):
    """Raised for business-rule validation failures (distinct from Pydantic schema errors)."""

    def __init__(self, message: str, error_code: str = "VALIDATION_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)
