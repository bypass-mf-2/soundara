"""
Rate limiting middleware for Soundara
Protects against DDoS attacks and abuse
"""

from fastapi import Request, HTTPException, status
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List
import asyncio
import os


class RateLimiter:
    """
    Rate limiter with per-minute and per-hour tracking
    Uses in-memory storage (for production, use Redis)
    """
    
    def __init__(
        self, 
        requests_per_minute: int = 60,
        requests_per_hour: int = 500,
        requests_per_day: int = 5000
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.requests_per_day = requests_per_day
        
        # Track requests by IP address
        self.minute_tracker: Dict[str, List[datetime]] = defaultdict(list)
        self.hour_tracker: Dict[str, List[datetime]] = defaultdict(list)
        self.day_tracker: Dict[str, List[datetime]] = defaultdict(list)
        
        # Track by user_id (for authenticated requests)
        self.user_minute_tracker: Dict[str, List[datetime]] = defaultdict(list)
        self.user_hour_tracker: Dict[str, List[datetime]] = defaultdict(list)
        self.user_day_tracker: Dict[str, List[datetime]] = defaultdict(list)
    
    def _clean_old_entries(self, tracker: Dict[str, List[datetime]], time_window: timedelta):
        """Remove entries older than time_window"""
        now = datetime.now()
        for key in list(tracker.keys()):
            tracker[key] = [
                timestamp for timestamp in tracker[key]
                if now - timestamp < time_window
            ]
            # Remove key if no entries left
            if not tracker[key]:
                del tracker[key]
    
    async def check_rate_limit(self, request: Request, user_id: str = None):
        """
        Check if request exceeds rate limits
        
        Args:
            request: FastAPI request object
            user_id: Optional authenticated user ID
        
        Raises:
            HTTPException: If rate limit is exceeded
        """
        client_ip = request.client.host if request.client else "unknown"
        now = datetime.now()
        
        # Clean old entries
        self._clean_old_entries(self.minute_tracker, timedelta(minutes=1))
        self._clean_old_entries(self.hour_tracker, timedelta(hours=1))
        self._clean_old_entries(self.day_tracker, timedelta(days=1))
        
        # Check IP-based limits
        minute_count = len(self.minute_tracker[client_ip])
        hour_count = len(self.hour_tracker[client_ip])
        day_count = len(self.day_tracker[client_ip])
        
        if minute_count >= self.requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {self.requests_per_minute} requests per minute. Try again in 60 seconds.",
                headers={"Retry-After": "60"}
            )
        
        if hour_count >= self.requests_per_hour:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {self.requests_per_hour} requests per hour. Try again later.",
                headers={"Retry-After": "3600"}
            )
        
        if day_count >= self.requests_per_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily rate limit exceeded: {self.requests_per_day} requests per day.",
                headers={"Retry-After": "86400"}
            )
        
        # Record request for IP
        self.minute_tracker[client_ip].append(now)
        self.hour_tracker[client_ip].append(now)
        self.day_tracker[client_ip].append(now)
        
        # If authenticated, also track by user_id
        if user_id:
            self._clean_old_entries(self.user_minute_tracker, timedelta(minutes=1))
            self._clean_old_entries(self.user_hour_tracker, timedelta(hours=1))
            self._clean_old_entries(self.user_day_tracker, timedelta(days=1))
            
            user_minute_count = len(self.user_minute_tracker[user_id])
            user_hour_count = len(self.user_hour_tracker[user_id])
            
            # Authenticated users get slightly higher limits
            if user_minute_count >= self.requests_per_minute * 1.5:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="User rate limit exceeded"
                )
            
            self.user_minute_tracker[user_id].append(now)
            self.user_hour_tracker[user_id].append(now)
            self.user_day_tracker[user_id].append(now)
    
    def get_remaining_requests(self, client_ip: str) -> dict:
        """Get remaining requests for an IP"""
        now = datetime.now()
        
        # Clean old entries
        self._clean_old_entries(self.minute_tracker, timedelta(minutes=1))
        self._clean_old_entries(self.hour_tracker, timedelta(hours=1))
        
        minute_count = len(self.minute_tracker.get(client_ip, []))
        hour_count = len(self.hour_tracker.get(client_ip, []))
        
        return {
            "requests_per_minute_remaining": max(0, self.requests_per_minute - minute_count),
            "requests_per_hour_remaining": max(0, self.requests_per_hour - hour_count),
            "requests_per_minute_limit": self.requests_per_minute,
            "requests_per_hour_limit": self.requests_per_hour
        }


class EndpointRateLimiter:
    """
    More granular rate limiting for specific endpoints
    e.g., stricter limits on file processing vs. library viewing
    """
    
    def __init__(self):
        self.trackers: Dict[str, Dict[str, List[datetime]]] = defaultdict(lambda: defaultdict(list))
    
    async def check_endpoint_limit(
        self,
        endpoint: str,
        client_ip: str,
        limit: int,
        window_minutes: int
    ):
        """
        Check rate limit for specific endpoint
        
        Args:
            endpoint: Endpoint path (e.g., "/process/")
            client_ip: Client IP address
            limit: Maximum requests allowed
            window_minutes: Time window in minutes
        
        Raises:
            HTTPException: If endpoint-specific limit is exceeded
        """
        now = datetime.now()
        window = timedelta(minutes=window_minutes)
        
        # Clean old entries
        self.trackers[endpoint][client_ip] = [
            timestamp for timestamp in self.trackers[endpoint][client_ip]
            if now - timestamp < window
        ]
        
        count = len(self.trackers[endpoint][client_ip])
        
        if count >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Endpoint rate limit exceeded: {limit} requests per {window_minutes} minutes for {endpoint}",
                headers={"Retry-After": str(window_minutes * 60)}
            )
        
        self.trackers[endpoint][client_ip].append(now)


# Global rate limiter instances
# Load limits from environment variables with defaults
rate_limiter = RateLimiter(
    requests_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "60")),
    requests_per_hour=int(os.getenv("RATE_LIMIT_PER_HOUR", "500")),
    requests_per_day=int(os.getenv("RATE_LIMIT_PER_DAY", "5000"))
)

endpoint_limiter = EndpointRateLimiter()


# Predefined endpoint limits (stricter for expensive operations)
ENDPOINT_LIMITS = {
    "/process/": {"limit": 10, "window_minutes": 60},  # 10 audio processing per hour
    "/process_custom/": {"limit": 5, "window_minutes": 60},  # 5 custom processing per hour
    "/upload/original/": {"limit": 20, "window_minutes": 60},  # 20 uploads per hour
    "/generate/ai/": {"limit": 3, "window_minutes": 60},  # 3 AI generations per hour (expensive)
}


async def apply_endpoint_limit(endpoint: str, client_ip: str):
    """
    Apply endpoint-specific rate limit
    
    Args:
        endpoint: Endpoint path
        client_ip: Client IP address
    """
    if endpoint in ENDPOINT_LIMITS:
        config = ENDPOINT_LIMITS[endpoint]
        await endpoint_limiter.check_endpoint_limit(
            endpoint, 
            client_ip, 
            config["limit"], 
            config["window_minutes"]
        )