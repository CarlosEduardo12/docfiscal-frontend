import { NextRequest, NextResponse } from 'next/server';
import { PaymentStatus } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const { paymentId } = params;

    if (!paymentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment ID is required',
          message: 'Invalid payment ID provided',
        },
        { status: 400 }
      );
    }

    // Mock payment status check
    // In production, this would query MercadoPago API:
    // const mercadopago = require('mercadopago');
    // const payment = await mercadopago.payment.findById(paymentId);

    const mockPaymentStatus: PaymentStatus = {
      paymentId,
      status: Math.random() > 0.5 ? 'approved' : 'pending', // Random status for demo
      orderId: paymentId.includes('_') ? paymentId.split('_')[1] : 'unknown',
      amount: 29.99, // Mock amount
      currency: 'USD',
    };

    return NextResponse.json({
      success: true,
      data: mockPaymentStatus,
      message: 'Payment status retrieved successfully',
    });
  } catch (error) {
    console.error('Payment status check error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Payment status check failed',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
