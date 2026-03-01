import stripe
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Replace with your actual secret key
stripe.api_key = "sk_test_your_secret_key_here"



# Example: create a payment intent (for pay-per-file)
def create_payment_intent(amount_cents: int, currency="usd"):
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,  # e.g., $5 = 500 cents
        currency=currency,
        payment_method_types=["card"],  # supports Apple Pay / Google Pay automatically
    )
    return intent.client_secret


def calculate_price(file_size_bytes: int, duration_sec: float) -> int:
    # Base price: $0.05 per MB
    mb_size = file_size_bytes / (1024 * 1024)
    base_price = 0.05 * mb_size

    # Add duration surcharge: $0.01 per minute
    duration_min = duration_sec / 60
    total_price = base_price + (0.01 * duration_min)

    # Convert to cents for Stripe
    return int(total_price * 100)

