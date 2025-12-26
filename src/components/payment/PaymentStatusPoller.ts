import { apiClient } from '@/lib/api';

export interface PaymentStatusPollerConfig {
  paymentId: string;
  initialInterval?: number;
  maxInterval?: number;
  backoffMultiplier?: number;
  maxAttempts?: number;
  onStatusChange?: (status: PaymentStatus) => void;
  onError?: (error: Error) => void;
}

export interface PaymentStatus {
  payment_id: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired' | 'timeout';
  order_id: string;
  error_message?: string;
  paid_at?: string;
  failed_at?: string;
}

export class PaymentStatusPoller {
  private config: Required<PaymentStatusPollerConfig>;
  private currentInterval: number;
  private attempts: number = 0;
  private timeoutId: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;

  constructor(config: PaymentStatusPollerConfig) {
    this.config = {
      initialInterval: 3000, // 3 seconds
      maxInterval: 30000, // 30 seconds
      backoffMultiplier: 1.5,
      maxAttempts: 20,
      onStatusChange: () => {},
      onError: () => {},
      ...config
    };
    this.currentInterval = this.config.initialInterval;
  }

  public startPolling(): void {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.attempts = 0;
    this.currentInterval = this.config.initialInterval;
    this.scheduleNextPoll();
  }

  public stopPolling(): void {
    this.isPolling = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private scheduleNextPoll(): void {
    if (!this.isPolling || this.attempts >= this.config.maxAttempts) {
      this.stopPolling();
      return;
    }

    this.timeoutId = setTimeout(() => {
      this.pollStatus();
    }, this.currentInterval);
  }

  private async pollStatus(): Promise<void> {
    if (!this.isPolling) {
      return;
    }

    this.attempts++;

    try {
      const response = await apiClient.getPaymentStatus(this.config.paymentId);
      
      if (response.success && response.data) {
        const status = response.data as PaymentStatus;
        this.config.onStatusChange(status);

        // Stop polling if we reach a final status
        if (['paid', 'failed', 'cancelled', 'expired'].includes(status.status)) {
          this.stopPolling();
          return;
        }

        // Continue polling with normal backoff
        this.currentInterval = Math.min(
          this.currentInterval * this.config.backoffMultiplier,
          this.config.maxInterval
        );
      } else {
        throw new Error(response.error || 'Failed to get payment status');
      }
    } catch (error) {
      console.error('Payment status polling error:', error);
      this.config.onError(error as Error);

      // Use more aggressive backoff for errors
      this.currentInterval = Math.min(
        this.currentInterval * (this.config.backoffMultiplier * 2),
        this.config.maxInterval
      );
    }

    // Schedule next poll
    this.scheduleNextPoll();
  }

  public getCurrentInterval(): number {
    return this.currentInterval;
  }

  public getAttempts(): number {
    return this.attempts;
  }

  public isActive(): boolean {
    return this.isPolling;
  }
}