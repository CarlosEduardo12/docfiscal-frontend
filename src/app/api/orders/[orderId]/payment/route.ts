import { NextRequest, NextResponse } from 'next/server';
import { PaymentResponse } from '@/types';

// Mock MercadoPago integration for development
// In production, this would integrate with the actual MercadoPago SDK

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    // Validate order exists and is in pending_payment status
    // In a real implementation, this would check the database
    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order ID is required',
          message: 'Invalid order ID provided',
        },
        { status: 400 }
      );
    }

    // Mock MercadoPago payment creation
    // In production, this would use the MercadoPago SDK:
    // const mercadopago = require('mercadopago');
    // const preference = await mercadopago.preferences.create({...});

    const mockPaymentResponse: PaymentResponse = {
      paymentId: `mp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      paymentUrl: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=mock_${orderId}`,
      status: 'pending',
      message: 'Payment created successfully',
    };

    return NextResponse.json({
      success: true,
      data: mockPaymentResponse,
      message: 'Payment created successfully',
    });
  } catch (error) {
    console.error('Payment creation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Payment creation failed',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
