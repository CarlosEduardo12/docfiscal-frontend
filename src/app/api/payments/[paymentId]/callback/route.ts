import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const { paymentId } = params;
    const callbackData = await request.json();

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

    // Validate MercadoPago callback signature
    // In production, this would verify the webhook signature:
    // const isValidSignature = mercadopago.utils.validateSignature(
    //   request.headers.get('x-signature'),
    //   callbackData,
    //   process.env.MERCADOPAGO_WEBHOOK_SECRET
    // );

    console.log('Payment callback received:', {
      paymentId,
      callbackData,
      timestamp: new Date().toISOString(),
    });

    // Process payment status update
    // In production, this would:
    // 1. Update order status in database
    // 2. Send confirmation email
    // 3. Trigger order processing if payment approved

    const orderId =
      callbackData.external_reference || paymentId.split('_')[1] || 'unknown';
    const paymentStatus = callbackData.status || 'unknown';

    // Mock order status update based on payment status
    let orderStatus = 'pending_payment';
    if (paymentStatus === 'approved') {
      orderStatus = 'paid';
    } else if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
      orderStatus = 'failed';
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        status: orderStatus,
      },
      message: 'Payment callback processed successfully',
    });
  } catch (error) {
    console.error('Payment callback processing error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Payment callback processing failed',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
