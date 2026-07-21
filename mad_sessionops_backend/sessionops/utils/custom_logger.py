"""
Custom logger utility for consistent logging across the application.

Following Dalgo backend best practices for structured logging.
"""

import logging
from typing import Optional


class CustomLogger:
    """
    Custom logger wrapper for consistent logging across the application.
    Provides structured logging with context.
    """

    def __init__(self, name: str):
        """
        Initialize the custom logger.

        Args:
            name: The name of the logger (usually the module name)
        """
        self.logger = logging.getLogger(name)

    def debug(self, message: str, *args, **kwargs):
        """Log a debug message"""
        self.logger.debug(message, *args, **kwargs)

    def info(self, message: str, *args, **kwargs):
        """Log an info message"""
        self.logger.info(message, *args, **kwargs)

    def warning(self, message: str, *args, **kwargs):
        """Log a warning message"""
        self.logger.warning(message, *args, **kwargs)

    def error(self, message: str, *args, **kwargs):
        """Log an error message"""
        self.logger.error(message, *args, **kwargs)

    def critical(self, message: str, *args, **kwargs):
        """Log a critical message"""
        self.logger.critical(message, *args, **kwargs)

    def exception(self, message: str, *args, **kwargs):
        """Log an exception with traceback"""
        self.logger.exception(message, *args, **kwargs)


def get_logger(name: str) -> CustomLogger:
    """
    Get a custom logger instance.

    Args:
        name: The name of the logger

    Returns:
        CustomLogger instance
    """
    return CustomLogger(name)
