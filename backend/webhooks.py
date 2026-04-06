"""
Stripe webhook handler for Soundara
Handles payment confirmations, subscription events, and refunds
"""

import stripe
import os
import json
from fastapi import Request, HTTPException, status
from backend.logging_config import log_payment_event, log_security_event, logger

# Load Stripe configuration
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
USER_LIBRARY_FILE = "user_library.json"
SUBS_FILE = "user_subscriptions.json"


async def handle_stripe_webhook(request: Request):
    """
    Handle incoming Stripe webhook events
    
    Verifies webhook signature and processes events:
    - checkout.session.completed: Add track to user library
    - customer.subscription.created: Activate subscription
    - customer.subscription.deleted: Cancel subscription
    - charge.refunded: Handle refund
    
    Args:
        request: FastAPI request object
    
    Returns:
        Success response dictionary
    
    Raises:
        HTTPException: If signature verification fails
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        log_security_event(
            event_type="webhook_missing_signature",
            severity="medium",
            ip_address=request.client.host if request.client else None,
            details={"endpoint": "/webhook/stripe"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature"
        )
    
    # Verify webhook signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        # Invalid payload
        log_security_event(
            event_type="webhook_invalid_payload",
            severity="medium",
            ip_address=request.client.host if request.client else None
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError:
        # Invalid signature
        log_security_event(
            event_type="webhook_invalid_signature",
            severity="high",
            ip_address=request.client.host if request.client else None,
            details={"reason": "Possible webhook spoofing attempt"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )
    
    # Handle the event
    event_type = event["type"]
    logger.info(f"Processing Stripe webhook: {event_type}")
    
    try:
        if event_type == "checkout.session.completed":
            await handle_checkout_completed(event)
        
        elif event_type == "customer.subscription.created":
            await handle_subscription_created(event)
        
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(event)
        
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(event)
        
        elif event_type == "charge.refunded":
            await handle_refund(event)
        
        elif event_type == "payment_intent.payment_failed":
            await handle_payment_failed(event)
        
        else:
            logger.info(f"Unhandled webhook event type: {event_type}")
    
    except Exception as e:
        logger.error(f"Error processing webhook {event_type}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed"
        )
    
    return {"status": "success"}


async def handle_checkout_completed(event: dict):
    """
    Handle successful checkout completion
    Add purchased track to user's library
    """
    session = event["data"]["object"]
    
    # Extract user_id and track info from success_url parameters
    # Format: http://localhost:5173/success?user={user_id}&track={filename}
    success_url = session.get("success_url", "")
    
    # Parse URL parameters
    import urllib.parse
    parsed = urllib.parse.urlparse(success_url)
    params = urllib.parse.parse_qs(parsed.query)
    
    user_id = params.get("user", [None])[0]
    track_filename = params.get("track", [None])[0]
    
    if not user_id or not track_filename:
        logger.error(f"Missing user_id or track_filename in checkout session: {session['id']}")
        return
    
    # Load user library
    try:
        with open(USER_LIBRARY_FILE, "r") as f:
            library_data = json.load(f)
    except FileNotFoundError:
        library_data = {}
    
    # Initialize user library if needed
    if user_id not in library_data:
        library_data[user_id] = []
    
    # Load main library to get track details
    from backend.main import LIBRARY_FILE
    with open(LIBRARY_FILE, "r") as f:
        main_library = json.load(f)
    
    # Find the track
    track = next(
        (t for t in main_library if t.get("filename_full") == track_filename),
        None
    )
    
    if not track:
        logger.error(f"Track not found: {track_filename}")
        return
    
    # Check if already in library
    already_owned = any(
        t.get("filename_full") == track_filename 
        for t in library_data[user_id]
    )
    
    if not already_owned:
        library_data[user_id].append(track)
        
        # Save updated library
        with open(USER_LIBRARY_FILE, "w") as f:
            json.dump(library_data, f, indent=2)
        
        logger.info(f"Track added to library - User: {user_id}, Track: {track['name']}")
        
        # Log payment event
        log_payment_event(
            event_type="purchase",
            user_id=user_id,
            amount_cents=session.get("amount_total", 0),
            track_name=track["name"],
            success=True,
            details={
                "session_id": session["id"],
                "payment_status": session.get("payment_status")
            }
        )


async def handle_subscription_created(event: dict):
    """Handle new subscription creation"""
    subscription = event["data"]["object"]
    
    customer_id = subscription["customer"]
    
    # Get customer details to find user_id
    # You would need to maintain a mapping of Stripe customer_id to user_id
    # For now, we'll extract from metadata if available
    user_id = subscription.get("metadata", {}).get("user_id")
    
    if not user_id:
        logger.error(f"No user_id in subscription metadata: {subscription['id']}")
        return
    
    # Determine plan type
    plan_nickname = subscription["items"]["data"][0]["price"]["nickname"]
    plan_type = "unlimited" if "unlimited" in plan_nickname.lower() else "limited"
    
    # Load subscriptions
    try:
        with open(SUBS_FILE, "r") as f:
            subs = json.load(f)
    except FileNotFoundError:
        subs = {}
    
    # Create subscription record
    subs[user_id] = {
        "plan": plan_type,
        "stripe_subscription_id": subscription["id"],
        "status": subscription["status"],
        "current_period_end": subscription["current_period_end"],
        "tracks_used": 0 if plan_type == "limited" else None,
        "created_at": subscription["created"]
    }
    
    # Save subscriptions
    with open(SUBS_FILE, "w") as f:
        json.dump(subs, f, indent=2)
    
    logger.info(f"Subscription created - User: {user_id}, Plan: {plan_type}")
    
    log_payment_event(
        event_type="subscription",
        user_id=user_id,
        amount_cents=subscription["items"]["data"][0]["price"]["unit_amount"],
        success=True,
        details={
            "subscription_id": subscription["id"],
            "plan": plan_type
        }
    )


async def handle_subscription_updated(event: dict):
    """Handle subscription updates (e.g., plan changes)"""
    subscription = event["data"]["object"]
    user_id = subscription.get("metadata", {}).get("user_id")
    
    if not user_id:
        return
    
    try:
        with open(SUBS_FILE, "r") as f:
            subs = json.load(f)
    except FileNotFoundError:
        subs = {}
    
    if user_id in subs:
        subs[user_id]["status"] = subscription["status"]
        subs[user_id]["current_period_end"] = subscription["current_period_end"]
        
        with open(SUBS_FILE, "w") as f:
            json.dump(subs, f, indent=2)
        
        logger.info(f"Subscription updated - User: {user_id}, Status: {subscription['status']}")


async def handle_subscription_deleted(event: dict):
    """Handle subscription cancellation"""
    subscription = event["data"]["object"]
    user_id = subscription.get("metadata", {}).get("user_id")
    
    if not user_id:
        return
    
    try:
        with open(SUBS_FILE, "r") as f:
            subs = json.load(f)
    except FileNotFoundError:
        return
    
    if user_id in subs:
        subs[user_id]["status"] = "canceled"
        
        with open(SUBS_FILE, "w") as f:
            json.dump(subs, f, indent=2)
        
        logger.info(f"Subscription canceled - User: {user_id}")


async def handle_refund(event: dict):
    """Handle refund events"""
    charge = event["data"]["object"]
    
    logger.info(f"Refund processed - Amount: {charge['amount_refunded']}")
    
    # TODO: Remove track from user library if refund
    # This requires tracking which charge corresponds to which track purchase


async def handle_payment_failed(event: dict):
    """Handle failed payment attempts"""
    payment_intent = event["data"]["object"]
    
    logger.warning(f"Payment failed - ID: {payment_intent['id']}, Error: {payment_intent.get('last_payment_error')}")
    
    log_payment_event(
        event_type="failed",
        user_id=payment_intent.get("metadata", {}).get("user_id", "unknown"),
        amount_cents=payment_intent["amount"],
        success=False,
        details={
            "error": payment_intent.get("last_payment_error", {}).get("message")
        }
    )