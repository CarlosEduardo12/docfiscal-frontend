import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download, History } from 'lucide-react';

interface DownloadErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string;
  retryOptions: Array<{
    label: string;
    action: string;
    description: string;
  }>;
  onRetry?: () => void;
  onGoToHistory?: () => void;
  isRetrying?: boolean;
}

export const DownloadErrorDialog: React.FC<DownloadErrorDialogProps> = ({
  isOpen,
  onClose,
  errorMessage,
  retryOptions,
  onRetry,
  onGoToHistory,
  isRetrying = false,
}) => {
  const handleAction = (action: string) => {
    switch (action) {
      case 'retry':
        onRetry?.();
        break;
      case 'order_history':
        onGoToHistory?.();
        onClose();
        break;
      default:
        onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Download Failed
          </DialogTitle>
          <DialogDescription className="text-left">
            {errorMessage}
          </DialogDescription>
        </DialogHeader>

        {retryOptions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Available options:</p>
            <div className="space-y-2">
              {retryOptions.map((option, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {option.action === 'retry' ? (
                      <Download className="h-4 w-4 text-primary" />
                    ) : (
                      <History className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={option.action === 'retry' ? 'default' : 'outline'}
                    onClick={() => handleAction(option.action)}
                    disabled={isRetrying && option.action === 'retry'}
                  >
                    {isRetrying && option.action === 'retry'
                      ? 'Retrying...'
                      : 'Select'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
