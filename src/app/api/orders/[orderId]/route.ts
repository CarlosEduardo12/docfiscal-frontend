import { NextRequest, NextResponse } from 'next/server';
import { Order } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

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

    // Mock order data
    // In production, this would query the database
    const mockOrder: Order = {
      id: orderId,
      userId: 'user_123',
      filename: 'sample_document.pdf',
      originalFileSize: 2048576, // 2MB
      status:
        Math.random() > 0.7
          ? 'completed'
          : Math.random() > 0.5
            ? 'processing'
            : Math.random() > 0.3
              ? 'pending_payment'
              : 'failed',
      paymentId: `mp_${Date.now()}`,
      paymentUrl: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=mock_${orderId}`,
      downloadUrl:
        Math.random() > 0.5
          ? `https://api.docfiscal.com/downloads/${orderId}.csv`
          : undefined,
      errorMessage:
        Math.random() > 0.8
          ? 'Processing failed due to invalid PDF format'
          : undefined,
      createdAt: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
      updatedAt: new Date(),
      completedAt: Math.random() > 0.5 ? new Date() : undefined,
    };

    return NextResponse.json({
      success: true,
      data: mockOrder,
      message: 'Order retrieved successfully',
    });
  } catch (error) {
    console.error('Order retrieval error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Order retrieval failed',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
