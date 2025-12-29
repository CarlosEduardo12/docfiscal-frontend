import React from 'react';

interface DialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogFooterProps {
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  children,
  open = true,
  onOpenChange,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={() => onOpenChange?.(false)}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
};

export const DialogContent: React.FC<DialogContentProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto ${className}`}
    >
      {children}
    </div>
  );
};

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
  return <div className="mb-4">{children}</div>;
};

export const DialogTitle: React.FC<DialogTitleProps> = ({
  children,
  className = '',
}) => {
  return (
    <h2 className={`text-lg font-semibold text-gray-900 mb-2 ${className}`}>
      {children}
    </h2>
  );
};

export const DialogDescription: React.FC<DialogDescriptionProps> = ({
  children,
  className = '',
}) => {
  return (
    <p className={`text-sm text-gray-600 mb-4 ${className}`}>{children}</p>
  );
};

export const DialogFooter: React.FC<DialogFooterProps> = ({ children }) => {
  return <div className="flex justify-end space-x-2 mt-6">{children}</div>;
};
