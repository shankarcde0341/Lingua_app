import uuid
from typing import Dict, Any, Optional
from pydantic import BaseModel

class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: Dict[str, Any] = {}

class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str

class CheckoutStatusResponse(BaseModel):
    status: str = "complete"
    payment_status: str = "paid"
    amount_total: float = 0.0
    currency: str = "usd"

class WebhookEvent(BaseModel):
    event_type: str = "checkout.session.completed"
    session_id: str = ""
    payment_status: str = "paid"

class StripeCheckout:
    def __init__(self, api_key: str = "", webhook_url: str = ""):
        self.api_key = api_key
        self.webhook_url = webhook_url

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        session_id = f"cs_test_{uuid.uuid4().hex}"
        url = request.success_url.replace("{CHECKOUT_SESSION_ID}", session_id)
        return CheckoutSessionResponse(session_id=session_id, url=url)

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        return CheckoutStatusResponse(
            status="complete",
            payment_status="paid",
            amount_total=10.0,
            currency="usd"
        )

    async def handle_webhook(self, payload: bytes, signature: Optional[str] = None) -> WebhookEvent:
        return WebhookEvent(
            event_type="checkout.session.completed",
            session_id="cs_test_mock",
            payment_status="paid"
        )
