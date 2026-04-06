"""
Logging and monitoring configuration for Soundara
Tracks security events, errors, and suspicious activity
"""

import logging
import os
import json
from datetime import datetime
from typing import Any, Dict
from pathlib import Path

# Create logs directory if it doesn't exist
LOGS_DIR = Path("logs")
LOGS_DIR.mkdir(exist_ok=True)

# Log file paths
APP_LOG = LOGS_DIR / "app.log"
SECURITY_LOG = LOGS_DIR / "security.log"
ERROR_LOG = LOGS_DIR / "error.log"
ACCESS_LOG = LOGS_DIR / "access.log"

# Logging format
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
JSON_FORMAT = "%(message)s"

# Configure general application logger
logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    handlers=[
        logging.FileHandler(APP_LOG),
        logging.StreamHandler()  # Also output to console
    ]
)

# Get logger instances
logger = logging.getLogger("soundara")
security_logger = logging.getLogger("security")
error_logger = logging.getLogger("error")
access_logger = logging.getLogger("access")

# Configure security logger (JSON format for easy parsing)
security_handler = logging.FileHandler(SECURITY_LOG)
security_handler.setFormatter(logging.Formatter(JSON_FORMAT))
security_logger.addHandler(security_handler)
security_logger.setLevel(logging.WARNING)

# Configure error logger
error_handler = logging.FileHandler(ERROR_LOG)
error_handler.setFormatter(logging.Formatter(LOG_FORMAT))
error_logger.addHandler(error_handler)
error_logger.setLevel(logging.ERROR)

# Configure access logger
access_handler = logging.FileHandler(ACCESS_LOG)
access_handler.setFormatter(logging.Formatter(JSON_FORMAT))
access_logger.addHandler(access_handler)
access_logger.setLevel(logging.INFO)


def log_security_event(
    event_type: str,
    severity: str,
    user_id: str = None,
    ip_address: str = None,
    details: Dict[str, Any] = None
):
    """
    Log security-related events in structured JSON format
    
    Args:
        event_type: Type of security event (e.g., "failed_login", "rate_limit_exceeded")
        severity: Severity level ("low", "medium", "high", "critical")
        user_id: User identifier if applicable
        ip_address: Client IP address
        details: Additional event details
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "severity": severity,
        "user_id": user_id,
        "ip_address": ip_address,
        "details": details or {}
    }
    
    # Log based on severity
    if severity == "critical":
        security_logger.critical(json.dumps(log_entry))
    elif severity == "high":
        security_logger.error(json.dumps(log_entry))
    elif severity == "medium":
        security_logger.warning(json.dumps(log_entry))
    else:
        security_logger.info(json.dumps(log_entry))


def log_suspicious_activity(
    activity_type: str,
    user_id: str = None,
    ip_address: str = None,
    details: Dict[str, Any] = None
):
    """
    Log potentially suspicious activity for investigation
    
    Args:
        activity_type: Type of suspicious activity
        user_id: User identifier
        ip_address: Client IP
        details: Additional details
    """
    log_security_event(
        event_type=f"suspicious_{activity_type}",
        severity="medium",
        user_id=user_id,
        ip_address=ip_address,
        details=details
    )


def log_access(
    method: str,
    endpoint: str,
    user_id: str = None,
    ip_address: str = None,
    status_code: int = None,
    response_time_ms: float = None
):
    """
    Log API access for analytics and monitoring
    
    Args:
        method: HTTP method (GET, POST, etc.)
        endpoint: API endpoint
        user_id: User identifier
        ip_address: Client IP
        status_code: HTTP response status code
        response_time_ms: Response time in milliseconds
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "method": method,
        "endpoint": endpoint,
        "user_id": user_id,
        "ip_address": ip_address,
        "status_code": status_code,
        "response_time_ms": response_time_ms
    }
    
    access_logger.info(json.dumps(log_entry))


def log_error(
    error_type: str,
    error_message: str,
    user_id: str = None,
    endpoint: str = None,
    traceback: str = None
):
    """
    Log application errors
    
    Args:
        error_type: Type of error
        error_message: Error message
        user_id: User identifier if applicable
        endpoint: Endpoint where error occurred
        traceback: Full traceback
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "error_type": error_type,
        "error_message": error_message,
        "user_id": user_id,
        "endpoint": endpoint,
        "traceback": traceback
    }
    
    error_logger.error(json.dumps(log_entry))


def log_payment_event(
    event_type: str,
    user_id: str,
    amount_cents: int,
    track_name: str = None,
    success: bool = True,
    details: Dict[str, Any] = None
):
    """
    Log payment-related events
    
    Args:
        event_type: Type of payment event ("purchase", "refund", "subscription")
        user_id: User identifier
        amount_cents: Amount in cents
        track_name: Track name if applicable
        success: Whether payment was successful
        details: Additional details
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "event_type": f"payment_{event_type}",
        "user_id": user_id,
        "amount_cents": amount_cents,
        "track_name": track_name,
        "success": success,
        "details": details or {}
    }
    
    logger.info(f"Payment event: {json.dumps(log_entry)}")


def log_file_operation(
    operation: str,
    filename: str,
    user_id: str = None,
    file_size_bytes: int = None,
    success: bool = True,
    error: str = None
):
    """
    Log file operations (upload, processing, deletion)
    
    Args:
        operation: Operation type ("upload", "process", "delete")
        filename: File name
        user_id: User identifier
        file_size_bytes: File size in bytes
        success: Whether operation succeeded
        error: Error message if failed
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "operation": operation,
        "filename": filename,
        "user_id": user_id,
        "file_size_bytes": file_size_bytes,
        "success": success,
        "error": error
    }
    
    if success:
        logger.info(f"File operation: {json.dumps(log_entry)}")
    else:
        logger.error(f"File operation failed: {json.dumps(log_entry)}")


# Security event types for reference
SECURITY_EVENTS = {
    "failed_login": "Failed login attempt",
    "rate_limit_exceeded": "Rate limit exceeded",
    "invalid_token": "Invalid JWT token",
    "unauthorized_access": "Unauthorized access attempt",
    "suspicious_file_upload": "Suspicious file upload detected",
    "path_traversal_attempt": "Path traversal attempt detected",
    "sql_injection_attempt": "SQL injection attempt detected",
    "xss_attempt": "XSS attack attempt detected",
    "brute_force_detected": "Brute force attack detected",
    "account_locked": "Account locked due to suspicious activity",
    "admin_action": "Admin action performed",
}


class SecurityMonitor:
    """
    Monitor for detecting patterns of suspicious activity
    """
    
    def __init__(self):
        self.failed_login_attempts = {}
        self.suspicious_ips = set()
    
    def record_failed_login(self, user_id: str, ip_address: str):
        """Track failed login attempts"""
        key = f"{user_id}:{ip_address}"
        
        if key not in self.failed_login_attempts:
            self.failed_login_attempts[key] = []
        
        self.failed_login_attempts[key].append(datetime.now())
        
        # Clean old attempts (older than 1 hour)
        cutoff = datetime.now().timestamp() - 3600
        self.failed_login_attempts[key] = [
            dt for dt in self.failed_login_attempts[key]
            if dt.timestamp() > cutoff
        ]
        
        # Check if brute force attack
        if len(self.failed_login_attempts[key]) >= 5:
            log_security_event(
                event_type="brute_force_detected",
                severity="high",
                user_id=user_id,
                ip_address=ip_address,
                details={"attempts": len(self.failed_login_attempts[key])}
            )
            
            self.suspicious_ips.add(ip_address)
    
    def is_suspicious_ip(self, ip_address: str) -> bool:
        """Check if IP is flagged as suspicious"""
        return ip_address in self.suspicious_ips
    
    def clear_ip_flag(self, ip_address: str):
        """Clear suspicious flag for IP"""
        self.suspicious_ips.discard(ip_address)


# Global security monitor instance
security_monitor = SecurityMonitor()