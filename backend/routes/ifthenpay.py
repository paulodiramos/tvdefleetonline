"""IFThenPay Payment Gateway Routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from typing import Dict, Optional
import logging
from datetime import datetime
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ifthenpay", tags=["ifthenpay"])

# Pydantic Models
class GenerateReferenceRequest(BaseModel):
    """Request to generate Multibanco reference."""
    amount: float = Field(..., gt=0, description="Payment amount in euros")
    order_id: str = Field(..., description="Unique order identifier")
    user_id: str = Field(..., description="User making the payment")
    description: Optional[str] = Field(None, description="Payment description")

class MultibancoReferenceResponse(BaseModel):
    """Response with Multibanco payment reference."""
    entity: str
    reference: str
    amount: float
    order_id: str
    expires_at: Optional[str] = None
    instructions: str = "Pague esta referência em qualquer terminal Multibanco ou homebanking"

class PaymentCallbackData(BaseModel):
    """Payment confirmation callback from IFThenPay."""
    reference: str
    amount: float
    entity: str
    terminal: Optional[str] = None
    date: Optional[str] = None
    chave: str = Field(..., description="Anti-phishing key")

class PaymentStatusResponse(BaseModel):
    """Payment status response."""
    reference: str
    status: str  # pending, paid, expired, error
    amount: Optional[float] = None
    paid_at: Optional[str] = None

# Helper function to get IFThenPay settings
def get_ifthenpay_settings():
    """Get IFThenPay configuration from environment."""
    api_key = os.getenv("IFTHENPAY_API_KEY")
    anti_phishing = os.getenv("IFTHENPAY_ANTI_PHISHING")
    entity = os.getenv("IFTHENPAY_ENTITY", "11604")
    enabled = os.getenv("IFTHENPAY_ENABLED", "false").lower() == "true"
    
    if not enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="IFThenPay integration is currently disabled"
        )
    
    if not api_key or not anti_phishing:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="IFThenPay configuration incomplete"
        )
    
    return {
        "api_key": api_key,
        "anti_phishing": anti_phishing,
        "entity": entity
    }

@router.post(
    "/generate-reference",
    response_model=MultibancoReferenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Multibanco Payment Reference",
    description="Creates a new Multibanco payment reference for a given amount"
)
async def generate_multibanco_reference(
    request: GenerateReferenceRequest
) -> MultibancoReferenceResponse:
    """
    Generate Multibanco reference for payment.
    
    This endpoint creates a Multibanco reference that users can pay at ATMs
    or via homebanking. The reference is unique to this payment.
    
    Args:
        request: Payment details including amount and order ID
        
    Returns:
        Multibanco reference details with entity and reference number
        
    Raises:
        HTTPException: If IFThenPay is disabled or configuration is incomplete
    """
    try:
        settings = get_ifthenpay_settings()
        
        # Import service here to avoid circular imports
        from app.services.ifthenpay_service import IFThenPayService
        
        service = IFThenPayService(
            api_key=settings["api_key"],
            anti_phishing_key=settings["anti_phishing"]
        )
        
        # Generate reference
        reference_data = service.generate_multibanco_reference(
            amount=request.amount,
            order_id=request.order_id,
            entity=settings["entity"]
        )
        
        # Store payment reference in database
        # TODO: Implement database storage
        logger.info(f"Generated Multibanco reference for order {request.order_id}: {reference_data['reference']}")
        
        return MultibancoReferenceResponse(**reference_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating reference: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate payment reference: {str(e)}"
        )

@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="IFThenPay Payment Callback",
    description="Receives payment confirmation callbacks from IFThenPay"
)
async def payment_webhook(
    request: Request,
    callback: PaymentCallbackData
):
    """
    Handle payment confirmation callback from IFThenPay.
    
    This endpoint receives notifications when a payment is confirmed.
    It verifies the anti-phishing key and updates the payment status.
    
    Args:
        callback: Payment confirmation data from IFThenPay
        
    Returns:
        Success confirmation
        
    Raises:
        HTTPException: If callback verification fails
    """
    try:
        settings = get_ifthenpay_settings()
        
        from app.services.ifthenpay_service import IFThenPayService
        
        service = IFThenPayService(
            api_key=settings["api_key"],
            anti_phishing_key=settings["anti_phishing"]
        )
        
        # Verify callback authenticity
        is_valid = service.verify_payment_callback(
            callback_data=callback.dict(),
            expected_anti_phishing=settings["anti_phishing"]
        )
        
        if not is_valid:
            logger.warning(f"Invalid payment callback received for reference {callback.reference}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid anti-phishing key"
            )
        
        # Process payment confirmation
        logger.info(f"Payment confirmed for reference {callback.reference}: €{callback.amount}")
        
        # TODO: Update payment status in database
        # TODO: Trigger any post-payment actions (send email, update user subscription, etc.)
        
        return {
            "status": "success",
            "message": "Payment confirmed",
            "reference": callback.reference
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing payment callback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process payment callback: {str(e)}"
        )

@router.get(
    "/payment-status/{reference}",
    response_model=PaymentStatusResponse,
    summary="Check Payment Status",
    description="Query the current status of a payment by reference"
)
async def check_payment_status(
    reference: str,
    entity: Optional[str] = None
) -> PaymentStatusResponse:
    """
    Check the status of a payment by reference.
    
    Args:
        reference: Multibanco reference number
        entity: Multibanco entity (optional, uses default if not provided)
        
    Returns:
        Payment status information
        
    Raises:
        HTTPException: If status check fails
    """
    try:
        settings = get_ifthenpay_settings()
        
        from app.services.ifthenpay_service import IFThenPayService
        
        service = IFThenPayService(
            api_key=settings["api_key"],
            anti_phishing_key=settings["anti_phishing"]
        )
        
        entity = entity or settings["entity"]
        
        # Check status via API
        status_data = await service.check_payment_status(
            reference=reference,
            entity=entity
        )
        
        # Parse response
        if status_data.get("status") == "error":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=status_data.get("message", "Failed to check status")
            )
        
        return PaymentStatusResponse(
            reference=reference,
            status=status_data.get("payment_status", "pending"),
            amount=status_data.get("amount"),
            paid_at=status_data.get("paid_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking payment status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check payment status: {str(e)}"
        )

@router.get(
    "/health",
    summary="IFThenPay Integration Health Check"
)
async def health_check():
    """Check if IFThenPay integration is properly configured and enabled."""
    try:
        settings = get_ifthenpay_settings()
        return {
            "status": "healthy",
            "enabled": True,
            "entity": settings["entity"],
            "configured": True
        }
    except HTTPException as e:
        return {
            "status": "unhealthy",
            "enabled": False,
            "error": e.detail
        }
