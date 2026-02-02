import uuid
import random


class TilledClient:
    def execute_payment(self, amount, currency):
        """
        Mocked Tilled execution.
        Later this will call real Tilled APIs.
        """
        # Simulate random success/failure
        if random.random() < 0.9:
            return {
                "success": True,
                "provider_payment_id": str(uuid.uuid4()),
            }

        return {
            "success": False,
            "error": "Insufficient funds",
        }
