/**
 * Property-Based Tests for Status Indicator Consistency
 * Feature: frontend-issues-resolution, Property 34: Order statuses use consistent visual indicators
 * Validates: Requirements 9.2
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import fc from 'fast-check';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { 
  StatusIndicator, 
  CompactStatusIndicator, 
  StatusProgress,
  getStatusConfig 
} from '@/components/ui/status-indicator';
import type { OrderStatus } from '@/types';

// Generators for property-based testing
const orderStatusGenerator = fc.oneof(
  fc.constant('pending_payment' as OrderStatus),
  fc.constant('paid' as OrderStatus),
  fc.constant('processing' as OrderStatus),
  fc.constant('completed' as OrderStatus),
  fc.constant('failed' as OrderStatus)
);

const sizeGenerator = fc.oneof(
  fc.constant('sm' as const),
  fc.constant('md' as const),
  fc.constant('lg' as const)
);

const booleanOptionsGenerator = fc.record({
  showDescription: fc.boolean(),
  showIcon: fc.boolean(),
  showBadge: fc.boolean()
});

describe('Status Indicator Consistency Properties', () => {
  // Ensure proper cleanup between tests to prevent DOM pollution
  afterEach(() => {
    cleanup();
  });

  /**
   * Property 34: Order statuses use consistent visual indicators
   * For any order status display, the system should use consistent visual indicators 
   * with clear labels and descriptions of what each status means
   */
  
  it('should use consistent visual indicators for all order statuses', () => {
    fc.assert(
      fc.property(orderStatusGenerator, (status) => {
        // Arrange: Get status configuration
        const config = getStatusConfig(status);
        
        // Act & Assert: Verify consistent configuration structure
        expect(config).toBeDefined();
        expect(config.icon).toBeDefined();
        expect(config.label).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.color).toBeDefined();
        expect(config.bgColor).toBeDefined();
        expect(config.borderColor).toBeDefined();
        expect(config.badgeVariant).toBeDefined();
        expect(config.iconColor).toBeDefined();
        
        // Verify label is not empty
        expect(config.label.trim().length).toBeGreaterThan(0);
        
        // Verify description is meaningful
        expect(config.description.trim().length).toBeGreaterThan(0);
        
        // Verify color classes follow consistent pattern
        expect(config.color).toMatch(/^text-\w+-\d+$/);
        expect(config.bgColor).toMatch(/^bg-\w+-\d+$/);
        expect(config.borderColor).toMatch(/^border-\w+-\d+$/);
        expect(config.iconColor).toMatch(/^text-\w+-\d+$/);
        
        // Verify badge variant is valid
        expect(['default', 'secondary', 'destructive', 'outline']).toContain(config.badgeVariant);
      }),
      { numRuns: 100 }
    );
  });

  it('should render status indicators with consistent structure and accessibility', () => {
    fc.assert(
      fc.property(
        orderStatusGenerator,
        sizeGenerator,
        booleanOptionsGenerator,
        (status, size, options) => {
          // Arrange & Act: Render status indicator with isolated container
          const { container, unmount } = render(
            <div data-testid={`status-test-${status}-${Date.now()}`}>
              <StatusIndicator 
                status={status} 
                size={size}
                {...options}
              />
            </div>
          );
          
          try {
            // Assert: Verify consistent structure
            const statusElement = container.querySelector('[role="status"]');
            expect(statusElement).toBeTruthy();
            expect(statusElement?.getAttribute('aria-label')).toContain('Status:');
            
            const config = getStatusConfig(status);
            
            // Verify label is present within this specific container
            const hasLabel = Array.from(container.querySelectorAll('*'))
              .some(el => el.textContent?.includes(config.label));
            expect(hasLabel).toBe(true);
            
            // Verify icon presence based on showIcon option
            if (options.showIcon) {
              const iconElement = container.querySelector('[aria-hidden="true"]');
              expect(iconElement).toBeTruthy();
            }
            
            // Verify description presence based on showDescription option
            if (options.showDescription) {
              const hasDescription = Array.from(container.querySelectorAll('*'))
                .some(el => el.textContent?.includes(config.description));
              expect(hasDescription).toBe(true);
            }
            
            // Verify badge presence based on showBadge option
            if (options.showBadge) {
              const badgeElement = container.querySelector('.inline-flex');
              expect(badgeElement).toBeTruthy();
            }
          } finally {
            // Clean up this specific render
            unmount();
          }
        }
      ),
      { numRuns: 25 } // Reduced runs to prevent DOM pollution
    );
  });

  it('should provide consistent compact status indicators', () => {
    fc.assert(
      fc.property(orderStatusGenerator, (status) => {
        // Arrange & Act: Render compact status indicator with isolated container
        const { container, unmount } = render(
          <div data-testid={`compact-test-${status}-${Date.now()}`}>
            <CompactStatusIndicator status={status} />
          </div>
        );
        
        try {
          // Assert: Verify consistent compact structure
          const statusElement = container.querySelector('[role="status"]');
          expect(statusElement).toBeTruthy();
          expect(statusElement?.getAttribute('aria-label')).toContain('Status:');
          
          // Verify icon is present
          const iconElement = container.querySelector('[aria-hidden="true"]');
          expect(iconElement).toBeTruthy();
          
          // Verify badge is present
          const badgeElement = container.querySelector('.inline-flex');
          expect(badgeElement).toBeTruthy();
          
          const config = getStatusConfig(status);
          // Use container-specific query to avoid conflicts
          const labelInContainer = Array.from(container.querySelectorAll('*'))
            .some(el => el.textContent?.includes(config.label));
          expect(labelInContainer).toBe(true);
        } finally {
          unmount();
        }
      }),
      { numRuns: 25 }
    );
  });

  it('should display consistent status progress for multi-step processes', () => {
    fc.assert(
      fc.property(orderStatusGenerator, (currentStatus) => {
        // Arrange & Act: Render status progress with isolated container
        const { container, unmount } = render(
          <div data-testid={`progress-test-${currentStatus}-${Date.now()}`}>
            <StatusProgress currentStatus={currentStatus} />
          </div>
        );
        
        try {
          // Assert: Verify progress structure
          expect(container.firstChild).toBeTruthy();
          
          if (currentStatus === 'failed') {
            // Failed status should show error indicator
            const errorText = Array.from(container.querySelectorAll('*'))
              .some(el => el.textContent?.includes('Processamento Falhou') || 
                         el.textContent?.includes('Erro') ||
                         el.textContent?.includes('Falhou'));
            expect(errorText).toBe(true);
          } else {
            // Normal statuses should show progress steps
            const allStatuses = ['pending_payment', 'paid', 'processing', 'completed'];
            
            // Verify status labels are present in container
            allStatuses.forEach((status) => {
              const config = getStatusConfig(status as OrderStatus);
              const labelInContainer = Array.from(container.querySelectorAll('*'))
                .some(el => el.textContent?.includes(config.label));
              expect(labelInContainer).toBe(true);
            });
            
            // Verify icons are present
            const icons = container.querySelectorAll('[aria-hidden="true"]');
            expect(icons.length).toBeGreaterThanOrEqual(1);
          }
        } finally {
          unmount();
        }
      }),
      { numRuns: 25 }
    );
  });

  it('should maintain consistent status mappings across different components', () => {
    fc.assert(
      fc.property(orderStatusGenerator, (status) => {
        // Arrange: Get status config
        const config = getStatusConfig(status);
        
        // Act: Render different status components with isolated containers
        const { container: standardContainer, unmount: unmountStandard } = render(
          <div data-testid={`mapping-standard-${status}-${Date.now()}`}>
            <StatusIndicator status={status} />
          </div>
        );
        const { container: compactContainer, unmount: unmountCompact } = render(
          <div data-testid={`mapping-compact-${status}-${Date.now()}`}>
            <CompactStatusIndicator status={status} />
          </div>
        );
        
        try {
          // Assert: Verify consistent labeling across components
          const standardHasLabel = Array.from(standardContainer.querySelectorAll('*'))
            .some(el => el.textContent?.includes(config.label));
          
          const compactHasLabel = Array.from(compactContainer.querySelectorAll('*'))
            .some(el => el.textContent?.includes(config.label));
          
          expect(standardHasLabel).toBe(true);
          expect(compactHasLabel).toBe(true);
          
          // Verify same status produces same configuration
          const config2 = getStatusConfig(status);
          expect(config).toEqual(config2);
        } finally {
          unmountStandard();
          unmountCompact();
        }
      }),
      { numRuns: 25 }
    );
  });

  it('should handle animation consistently for processing status', () => {
    fc.assert(
      fc.property(orderStatusGenerator, (status) => {
        // Arrange & Act: Render status indicator with isolated container
        const { container, unmount } = render(
          <div data-testid={`animation-test-${status}-${Date.now()}`}>
            <StatusIndicator status={status} />
          </div>
        );
        
        try {
          // Assert: Verify animation behavior
          const config = getStatusConfig(status);
          const animatedElements = container.querySelectorAll('.animate-spin');
          
          if (config.animated) {
            expect(animatedElements.length).toBeGreaterThan(0);
          } else {
            // Non-animated statuses should not have spin animation
            expect(animatedElements.length).toBe(0);
          }
        } finally {
          unmount();
        }
      }),
      { numRuns: 25 }
    );
  });

  it('should provide meaningful descriptions for all statuses', () => {
    fc.assert(
      fc.property(orderStatusGenerator, (status) => {
        // Arrange: Get status configuration
        const config = getStatusConfig(status);
        
        // Act & Assert: Verify description quality
        expect(config.description).toBeDefined();
        expect(config.description.trim().length).toBeGreaterThan(5);
        
        // Verify description contains meaningful information (more flexible check)
        const description = config.description.toLowerCase();
        const hasMeaningfulContent = 
          description.includes('clique') ||
          description.includes('aguarde') ||
          description.includes('pronto') ||
          description.includes('erro') ||
          description.includes('tente') ||
          description.includes('pagamento') ||
          description.includes('processando') ||
          description.includes('concluído') ||
          description.includes('download') ||
          description.includes('arquivo') ||
          description.includes('falhou') ||
          description.includes('convertido') ||
          description.includes('pago') ||
          description.includes('pendente');
        
        expect(hasMeaningfulContent).toBe(true);
      }),
      { numRuns: 50 }
    );
  });
});