import stripe
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

stripe.api_key = "sk_test_your_secret_key_here"

MIN_PRICE_CENTS = 170  # $1.70 minimum

def create_payment_intent(amount_cents: int, currency="usd"):
    """
    Create a Stripe PaymentIntent for the given amount in cents.
    """
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency=currency,
        payment_method_types=["card"],
    )
    return intent.client_secret


def calculate_price(file_size_bytes: int, custom_mode: bool = False) -> int:
    """
    Calculate price based on file size at $0.07 per MB, with minimum $1.70.
    Optionally adds extra fee for custom modes.
    Returns price in cents for Stripe.
    """
    mb_size = file_size_bytes / (1024 * 1024)
    base_price = 0.08 * mb_size * 100  # price in cents
    price_cents = max(int(base_price), MIN_PRICE_CENTS)

    if custom_mode:
        price_cents += 150  # $1.50 extra for custom frequencies

    return price_cents