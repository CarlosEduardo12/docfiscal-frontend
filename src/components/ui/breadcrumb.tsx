'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
  completed?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

export function Breadcrumb({ items, className, showHome = true }: BreadcrumbProps) {
  return (
    <nav
      className={cn('flex items-center space-x-1 text-sm', className)}
      aria-label="Breadcrumb navigation"
      role="navigation"
    >
      {showHome && (
        <>
          <Link
            href="/"
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Home"
          >
            <Home className="h-4 w-4" />
          </Link>
          {items.length > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </>
      )}
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {item.href && !item.active ? (
              <Link
                href={item.href}
                className={cn(
                  'text-muted-foreground hover:text-foreground transition-colors',
                  item.completed && 'text-green-600 hover:text-green-700'
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'font-medium',
                  item.active ? 'text-foreground' : 'text-muted-foreground',
                  item.completed && 'text-green-600'
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
            
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// Process-specific breadcrumb components
export interface ProcessBreadcrumbProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function UploadProcessBreadcrumb({ currentStep, totalSteps = 4, className }: ProcessBreadcrumbProps) {
  const steps = [
    { label: 'Upload File', completed: currentStep > 1, active: currentStep === 1 },
    { label: 'Payment', completed: currentStep > 2, active: currentStep === 2 },
    { label: 'Processing', completed: currentStep > 3, active: currentStep === 3 },
    { label: 'Download', completed: currentStep > 4, active: currentStep === 4 }
  ];

  return (
    <Breadcrumb
      items={steps}
      className={className}
      showHome={false}
    />
  );
}

export function PaymentProcessBreadcrumb({ currentStep, totalSteps = 3, className }: ProcessBreadcrumbProps) {
  const steps = [
    { label: 'Order Review', completed: currentStep > 1, active: currentStep === 1 },
    { label: 'Payment', completed: currentStep > 2, active: currentStep === 2 },
    { label: 'Confirmation', completed: currentStep > 3, active: currentStep === 3 }
  ];

  return (
    <Breadcrumb
      items={steps}
      className={className}
      showHome={false}
    />
  );
}