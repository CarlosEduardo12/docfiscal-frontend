export interface PaymentError {
  type: 'TIMEOUT' | 'CANCELLED' | 'EXPIRED' | 'NETWORK_ERROR' | 'INSUFFICIENT_FUNDS' | 'INVALID_CARD' | 'UNKNOWN';
  message: string;
  code?: string;
  details?: any;
}

export interface PaymentErrorResponse {
  userMessage: string;
  showRetryButton: boolean;
  showNewPaymentButton: boolean;
  showSupportButton: boolean;
  supportContact?: {
    email?: string;
    phone?: string;
    chat_url?: string;
  };
  recoveryOptions: string[];
}

export class PaymentErrorHandler {
  private static readonly ERROR_MESSAGES: Record<PaymentError['type'], string> = {
    TIMEOUT: 'Payment timed out. Please try again.',
    CANCELLED: 'Payment was cancelled.',
    EXPIRED: 'Payment link has expired. Please generate a new payment.',
    NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.',
    INSUFFICIENT_FUNDS: 'Insufficient funds. Please check your account balance.',
    INVALID_CARD: 'Invalid card information. Please check your payment details.',
    UNKNOWN: 'An unexpected error occurred. Please contact support if the problem persists.'
  };

  private static readonly SUPPORT_CONTACT = {
    email: 'support@docfiscal.com',
    phone: '+55 11 1234-5678',
    chat_url: 'https://docfiscal.com/support/chat'
  };

  public static handlePaymentError(error: PaymentError): PaymentErrorResponse {
    const userMessage = this.ERROR_MESSAGES[error.type] || this.ERROR_MESSAGES.UNKNOWN;

    switch (error.type) {
      case 'TIMEOUT':
        return {
          userMessage,
          showRetryButton: true,
          showNewPaymentButton: false,
          showSupportButton: false,
          recoveryOptions: ['retry_payment', 'check_payment_status', 'contact_support']
        };

      case 'CANCELLED':
        return {
          userMessage,
          showRetryButton: true,
          showNewPaymentButton: false,
          showSupportButton: false,
          recoveryOptions: ['retry_payment', 'new_payment_method']
        };

      case 'EXPIRED':
        return {
          userMessage,
          showRetryButton: false,
          showNewPaymentButton: true,
          showSupportButton: false,
          recoveryOptions: ['new_payment', 'contact_support']
        };

      case 'NETWORK_ERROR':
        return {
          userMessage,
          showRetryButton: true,
          showNewPaymentButton: false,
          showSupportButton: false,
          recoveryOptions: ['retry_payment', 'check_connection', 'contact_support']
        };

      case 'INSUFFICIENT_FUNDS':
        return {
          userMessage,
          showRetryButton: false,
          showNewPaymentButton: true,
          showSupportButton: true,
          supportContact: this.SUPPORT_CONTACT,
          recoveryOptions: ['new_payment_method', 'contact_support']
        };

      case 'INVALID_CARD':
        return {
          userMessage,
          showRetryButton: false,
          showNewPaymentButton: true,
          showSupportButton: false,
          recoveryOptions: ['new_payment_method', 'verify_card_details']
        };

      default:
        return {
          userMessage: this.ERROR_MESSAGES.UNKNOWN,
          showRetryButton: false,
          showNewPaymentButton: false,
          showSupportButton: true,
          supportContact: this.SUPPORT_CONTACT,
          recoveryOptions: ['contact_support']
        };
    }
  }

  public static getRetryStrategy(error: PaymentError): { retryable: boolean; maxRetries: number; backoffMultiplier: number } {
    switch (error.type) {
      case 'TIMEOUT':
      case 'NETWORK_ERROR':
        return {
          retryable: true,
          maxRetries: 3,
          backoffMultiplier: 2.0
        };

      case 'CANCELLED':
        return {
          retryable: true,
          maxRetries: 1,
          backoffMultiplier: 1.0
        };

      case 'EXPIRED':
      case 'INSUFFICIENT_FUNDS':
      case 'INVALID_CARD':
        return {
          retryable: false,
          maxRetries: 0,
          backoffMultiplier: 1.0
        };

      default:
        return {
          retryable: false,
          maxRetries: 0,
          backoffMultiplier: 1.0
        };
    }
  }

  public static isRecoverableError(error: PaymentError): boolean {
    return ['TIMEOUT', 'CANCELLED', 'NETWORK_ERROR'].includes(error.type);
  }

  public static getUserFriendlyMessage(error: PaymentError): string {
    return this.ERROR_MESSAGES[error.type] || this.ERROR_MESSAGES.UNKNOWN;
  }
}