/**
 * Property-based tests for breadcrumb navigation
 * Feature: frontend-issues-resolution, Property 33: Multi-step processes display breadcrumb navigation
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { Breadcrumb, UploadProcessBreadcrumb, PaymentProcessBreadcrumb, BreadcrumbItem } from '@/components/ui/breadcrumb';

// Clean up after each test to prevent interference
afterEach(() => {
  cleanup();
});

describe('Breadcrumb Navigation Properties', () => {
  /**
   * Property 33: Multi-step processes display breadcrumb navigation
   * For any multi-step process, the system should display breadcrumb navigation showing current step and progress
   * Validates: Requirements 9.1
   */
  
  describe('Property 33: Multi-step processes display breadcrumb navigation', () => {
    it('should display breadcrumb navigation for any valid breadcrumb items', () => {
      fc.assert(
        fc.property(
          // Generate valid breadcrumb items
          fc.array(
            fc.record({
              label: fc.string({ minLength: 2, maxLength: 20 }).filter(s => {
                const trimmed = s.trim();
                return trimmed.length >= 2 && 
                       /^[a-zA-Z0-9][a-zA-Z0-9\s\-_]*[a-zA-Z0-9]$/.test(trimmed);
              }),
              href: fc.option(
                fc.constantFrom('/dashboard', '/orders', '/upload', '/payment', '/profile'),
                { nil: null }
              ),
              active: fc.boolean(),
              completed: fc.boolean()
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (items: BreadcrumbItem[]) => {
            // Ensure only one item is active to avoid conflicts
            const processedItems = items.map((item, index) => ({
              ...item,
              label: item.label.trim(), // Normalize labels
              active: index === items.length - 1 // Only last item is active
            }));
            
            // Render in isolated container
            const { container, unmount } = render(<Breadcrumb items={processedItems} showHome={false} />);
            
            try {
              // Should render navigation element
              const nav = container.querySelector('nav[role="navigation"]');
              expect(nav).toBeInTheDocument();
              expect(nav).toHaveAttribute('aria-label', 'Breadcrumb navigation');
              
              // Should display all item labels using container queries for more reliable matching
              processedItems.forEach(item => {
                const textElements = Array.from(container.querySelectorAll('*')).filter(el => 
                  el.textContent?.trim() === item.label
                );
                expect(textElements.length).toBeGreaterThan(0);
              });
              
              // Should have proper ARIA attributes for active items
              const activeItems = processedItems.filter(item => item.active);
              activeItems.forEach(item => {
                const activeElements = Array.from(container.querySelectorAll('[aria-current="page"]')).filter(el =>
                  el.textContent?.trim() === item.label
                );
                expect(activeElements.length).toBeGreaterThan(0);
              });
              
              // Should render links for items with href (and not active)
              const linkItems = processedItems.filter(item => item.href && !item.active);
              linkItems.forEach(item => {
                const links = Array.from(container.querySelectorAll('a')).filter(link => 
                  link.textContent?.trim() === item.label && link.getAttribute('href') === item.href
                );
                expect(links.length).toBeGreaterThan(0);
              });
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should display process-specific breadcrumbs for upload workflow', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 4 }),
          (currentStep: number) => {
            const { container, unmount } = render(<UploadProcessBreadcrumb currentStep={currentStep} />);
            
            try {
              // Should render navigation
              const nav = container.querySelector('nav[role="navigation"]');
              expect(nav).toBeInTheDocument();
              
              // Should display all expected steps
              const expectedSteps = ['Upload File', 'Payment', 'Processing', 'Download'];
              expectedSteps.forEach(stepLabel => {
                const elements = screen.getAllByText(stepLabel);
                expect(elements.length).toBeGreaterThan(0);
              });
              
              // Current step should be marked as active
              const currentStepLabels = ['Upload File', 'Payment', 'Processing', 'Download'];
              const currentStepLabel = currentStepLabels[currentStep - 1];
              if (currentStepLabel) {
                const elements = screen.getAllByText(currentStepLabel);
                const activeElement = elements.find(el => el.getAttribute('aria-current') === 'page');
                expect(activeElement).toBeDefined();
              }
              
              // Previous steps should be marked as completed (have green color class)
              for (let i = 0; i < currentStep - 1; i++) {
                const stepElements = screen.getAllByText(currentStepLabels[i]);
                const completedElement = stepElements.find(el => 
                  el.className.includes('text-green-600')
                );
                expect(completedElement).toBeDefined();
              }
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should display process-specific breadcrumbs for payment workflow', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          (currentStep: number) => {
            const { container, unmount } = render(<PaymentProcessBreadcrumb currentStep={currentStep} />);
            
            try {
              // Should render navigation
              const nav = container.querySelector('nav[role="navigation"]');
              expect(nav).toBeInTheDocument();
              
              // Should display all expected steps
              const expectedSteps = ['Order Review', 'Payment', 'Confirmation'];
              expectedSteps.forEach(stepLabel => {
                const elements = screen.getAllByText(stepLabel);
                expect(elements.length).toBeGreaterThan(0);
              });
              
              // Current step should be marked as active
              const currentStepLabels = ['Order Review', 'Payment', 'Confirmation'];
              const currentStepLabel = currentStepLabels[currentStep - 1];
              if (currentStepLabel) {
                const elements = screen.getAllByText(currentStepLabel);
                const activeElement = elements.find(el => el.getAttribute('aria-current') === 'page');
                expect(activeElement).toBeDefined();
              }
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle navigation structure correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              label: fc.string({ minLength: 2, maxLength: 20 }).filter(s => {
                const trimmed = s.trim();
                return trimmed.length >= 2 && 
                       /^[a-zA-Z0-9][a-zA-Z0-9\s\-_]*[a-zA-Z0-9]$/.test(trimmed);
              }),
              href: fc.option(
                fc.constantFrom('/dashboard', '/orders', '/upload', '/payment', '/profile'),
                { nil: null }
              ),
              active: fc.boolean(),
              completed: fc.boolean()
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (items: BreadcrumbItem[]) => {
            // Ensure only one item is active and normalize labels
            const processedItems = items.map((item, index) => ({
              ...item,
              label: item.label.trim(), // Normalize labels
              active: index === items.length - 1 // Only last item is active
            }));
            
            const { container, unmount } = render(<Breadcrumb items={processedItems} showHome={true} />);
            
            try {
              // Should include home link when showHome is true
              const homeLinks = screen.getAllByLabelText('Home');
              expect(homeLinks.length).toBeGreaterThan(0);
              expect(homeLinks[0]).toHaveAttribute('href', '/');
              
              // Should have chevron separators between items
              const chevrons = container.querySelectorAll('[aria-hidden="true"]');
              // Should have at least one chevron (between home and first item)
              expect(chevrons.length).toBeGreaterThan(0);
              
              // Should display all breadcrumb items using container queries
              processedItems.forEach(item => {
                const textElements = Array.from(container.querySelectorAll('*')).filter(el => 
                  el.textContent?.trim() === item.label
                );
                expect(textElements.length).toBeGreaterThan(0);
              });
            } finally {
              unmount();
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});