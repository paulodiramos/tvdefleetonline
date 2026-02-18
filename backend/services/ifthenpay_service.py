# IFThenPay Service for Portuguese Payment Methods
import hashlib
import httpx
from typing import Dict, Optional
from datetime import datetime
import os

class IFThenPayService:
    """Service for IFThenPay payment gateway integration."""
    
    def __init__(self, api_key: str, anti_phishing_key: str):
        """Initialize IFThenPay service.
        
        Args:
            api_key: IFThenPay API key
            anti_phishing_key: Anti-phishing security key
        """
        self.api_key = api_key
        self.anti_phishing_key = anti_phishing_key
        self.base_url = "https://ifthenpay.com/api/multibanco"
    
    def generate_multibanco_reference(
        self,
        amount: float,
        order_id: str,
        entity: str = "11604"  # Default entity
    ) -> Dict:
        """Generate Multibanco payment reference.
        
        Args:
            amount: Payment amount in euros
            order_id: Unique order identifier
            entity: Multibanco entity (default: 11604)
            
        Returns:
            Dictionary with entity, reference, and amount
        """
        # Format amount (remove decimals, multiply by 100)
        amount_cents = int(amount * 100)
        
        # Generate reference (simplified - actual implementation may vary)
        # Reference format: 9 digits
        reference_base = str(order_id).zfill(8)
        check_digit = self._calculate_check_digit(reference_base)
        reference = reference_base + check_digit
        
        return {
            "entity": entity,
            "reference": reference,
            "amount": amount,
            "order_id": order_id,
            "expires_at": None  # Multibanco references don't expire by default
        }
    
    def _calculate_check_digit(self, reference: str) -> str:
        """Calculate check digit for reference."""
        # Simplified check digit calculation
        # Actual implementation should follow IFThenPay specifications
        weights = [3, 7, 1, 9, 3, 7, 1, 9]
        total = sum(int(ref) * weight for ref, weight in zip(reference, weights))
        check = (10 - (total % 10)) % 10
        return str(check)
    
    def verify_payment_callback(
        self,
        callback_data: Dict,
        expected_anti_phishing: str
    ) -> bool:
        """Verify payment callback authenticity.
        
        Args:
            callback_data: Data received from IFThenPay callback
            expected_anti_phishing: Expected anti-phishing key
            
        Returns:
            True if callback is authentic
        """
        received_key = callback_data.get("chave", "")
        return received_key == expected_anti_phishing
    
    async def check_payment_status(self, reference: str, entity: str) -> Dict:
        """Check payment status via API.
        
        Args:
            reference: Multibanco reference
            entity: Multibanco entity
            
        Returns:
            Payment status information
        """
        # This would call IFThenPay's status check API
        # Implementation depends on actual IFThenPay API documentation
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/status",
                    params={
                        "key": self.api_key,
                        "entity": entity,
                        "reference": reference
                    }
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                return {"status": "error", "message": str(e)}
