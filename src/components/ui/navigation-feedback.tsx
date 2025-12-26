'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  ArrowLeft, 
  Home, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Badge } from './badge';

export interface NavigationState {
  isNavigating: boolean;
  currentPath: string;
  previousPath?: string;
  navigationError?: string;
  navigationSuccess?: boolean;
}

export interface NavigationFeedbackProps {
  showBackButton?: boolean;
  showCurrentPath?: boolean;
  showNavigationState?: boolean;
  className?: string;
}

// Hook for navigation state management
export function useNavigationFeedback() {
  const router = useRouter();
  const pathname = usePathname();
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isNavigating: false,
    currentPath: pathname
  });

  useEffect(() => {
    setNavigationState(prev => ({
      ...prev,
      previousPath: prev.currentPath,
      currentPath: pathname,
      isNavigating: false,
      navigationSuccess: true,
      navigationError: undefined
    }));
  }, [pathname]);

  const navigateWithFeedback = (path: string) => {
    setNavigationState(prev => ({
      ...prev,
      isNavigating: true,
      navigationError: undefined,
      navigationSuccess: undefined
    }));

    try {
      router.push(path);
    } catch (error) {
      setNavigationState(prev => ({
        ...prev,
        isNavigating: false,
        navigationError: error instanceof Error ? error.message : 'Navigation failed',
        navigationSuccess: false
      }));
    }
  };

  const goBack = () => {
    setNavigationState(prev => ({
      ...prev,
      isNavigating: true
    }));
    
    try {
      router.back();
    } catch (error) {
      setNavigationState(prev => ({
        ...prev,
        isNavigating: false,
        navigationError: 'Cannot go back',
        navigationSuccess: false
      }));
    }
  };

  return {
    navigationState,
    navigateWithFeedback,
    goBack,
    currentPath: pathname
  };
}

// Navigation feedback component
export function NavigationFeedback({
  showBackButton = true,
  showCurrentPath = true,
  showNavigationState = true,
  className
}: NavigationFeedbackProps) {
  const { navigationState, goBack, currentPath } = useNavigationFeedback();

  const getPageTitle = (path: string): string => {
    const pathMap: Record<string, string> = {
      '/': 'Início',
      '/dashboard': 'Dashboard',
      '/upload': 'Upload de Arquivo',
      '/payment': 'Pagamento',
      '/orders': 'Meus Pedidos',
      '/profile': 'Perfil',
      '/help': 'Ajuda'
    };

    // Handle dynamic routes
    if (path.startsWith('/pedido/')) {
      return 'Detalhes do Pedido';
    }
    if (path.startsWith('/payment/')) {
      return 'Processamento de Pagamento';
    }

    return pathMap[path] || 'Página';
  };

  const getCurrentPageInfo = () => {
    const title = getPageTitle(currentPath);
    const isHomePage = currentPath === '/';
    const isDashboard = currentPath === '/dashboard';
    
    return {
      title,
      isHomePage,
      isDashboard,
      canGoBack: !isHomePage && navigationState.previousPath !== undefined
    };
  };

  const pageInfo = getCurrentPageInfo();

  return (
    <div 
      className={cn('flex items-center justify-between p-4 bg-background border-b', className)}
      role="navigation"
      aria-label="Navigation feedback"
    >
      {/* Left side - Back button and current page */}
      <div className="flex items-center space-x-4">
        {showBackButton && pageInfo.canGoBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            disabled={navigationState.isNavigating}
            aria-label="Voltar para página anterior"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        )}

        {showCurrentPath && (
          <div className="flex items-center space-x-2">
            <Navigation className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-lg font-semibold">{pageInfo.title}</h1>
            
            {!pageInfo.isHomePage && (
              <Badge variant="outline" className="text-xs">
                {currentPath}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Right side - Navigation state */}
      {showNavigationState && (
        <div className="flex items-center space-x-2">
          {navigationState.isNavigating && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Navegando...</span>
            </div>
          )}

          {navigationState.navigationSuccess && !navigationState.isNavigating && (
            <div className="flex items-center space-x-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Navegação bem-sucedida</span>
            </div>
          )}

          {navigationState.navigationError && (
            <div 
              className="flex items-center space-x-2 text-sm text-red-600"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span>{navigationState.navigationError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Breadcrumb navigation with feedback
export interface NavigationBreadcrumbProps {
  items: Array<{
    label: string;
    href?: string;
    active?: boolean;
  }>;
  className?: string;
}

export function NavigationBreadcrumb({ items, className }: NavigationBreadcrumbProps) {
  const { navigateWithFeedback, navigationState } = useNavigationFeedback();

  return (
    <nav 
      className={cn('flex items-center space-x-1 text-sm', className)}
      aria-label="Breadcrumb navigation"
      role="navigation"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigateWithFeedback('/')}
        disabled={navigationState.isNavigating}
        className="p-1"
        aria-label="Ir para página inicial"
      >
        <Home className="h-4 w-4" />
      </Button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            <span className="text-muted-foreground">/</span>
            
            {item.href && !item.active ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWithFeedback(item.href!)}
                disabled={navigationState.isNavigating}
                className="p-1 h-auto font-normal"
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </Button>
            ) : (
              <span
                className={cn(
                  'px-1',
                  item.active ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}

      {navigationState.isNavigating && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-2" aria-hidden="true" />
      )}
    </nav>
  );
}

// Page transition feedback
export interface PageTransitionProps {
  isTransitioning: boolean;
  transitionMessage?: string;
  className?: string;
}

export function PageTransition({ 
  isTransitioning, 
  transitionMessage = 'Carregando página...', 
  className 
}: PageTransitionProps) {
  if (!isTransitioning) return null;

  return (
    <div 
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center p-2">
        <div className="flex items-center space-x-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{transitionMessage}</span>
        </div>
      </div>
    </div>
  );
}

// Navigation patterns consistency
export const NAVIGATION_PATTERNS = {
  CONSISTENT_BACK_BUTTON: 'back-button',
  BREADCRUMB_NAVIGATION: 'breadcrumb',
  PAGE_TITLE_DISPLAY: 'page-title',
  LOADING_FEEDBACK: 'loading-feedback',
  ERROR_FEEDBACK: 'error-feedback',
  SUCCESS_FEEDBACK: 'success-feedback'
} as const;

export type NavigationPattern = typeof NAVIGATION_PATTERNS[keyof typeof NAVIGATION_PATTERNS];

// Validate navigation patterns
export function validateNavigationPattern(
  pattern: NavigationPattern,
  element: HTMLElement
): boolean {
  switch (pattern) {
    case NAVIGATION_PATTERNS.CONSISTENT_BACK_BUTTON:
      return element.querySelector('[aria-label*="Voltar"]') !== null;
    
    case NAVIGATION_PATTERNS.BREADCRUMB_NAVIGATION:
      return element.querySelector('[aria-label="Breadcrumb navigation"]') !== null;
    
    case NAVIGATION_PATTERNS.PAGE_TITLE_DISPLAY:
      return element.querySelector('h1') !== null;
    
    case NAVIGATION_PATTERNS.LOADING_FEEDBACK:
      return element.querySelector('.animate-spin') !== null;
    
    case NAVIGATION_PATTERNS.ERROR_FEEDBACK:
      return element.querySelector('[role="alert"]') !== null;
    
    case NAVIGATION_PATTERNS.SUCCESS_FEEDBACK:
      return element.querySelector('.text-green-600') !== null;
    
    default:
      return false;
  }
}