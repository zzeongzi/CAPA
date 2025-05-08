
import { useState, useEffect, useCallback } from "react";
import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

export function useToast() {
  const [toasts, setToasts] = useState<
    (ToastProps & { id: string; visible: boolean })[]
  >([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setToasts((toasts) => toasts.map((t) => ({ ...t, visible: false })));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toast = useCallback(({ title, description, action, variant }: ToastProps) => {
    const id = Math.random().toString(36).slice(2, 11);
    
    if (variant === "destructive") {
      sonnerToast.error(title, {
        description,
      });
    } else {
      sonnerToast(title, {
        description,
      });
    }

    const newToast = {
      id,
      title,
      description,
      action,
      variant,
      visible: true,
    };
    
    setToasts((toasts) => [...toasts, newToast]);
    
    setTimeout(() => {
      setToasts((toasts) =>
        toasts.map((t) => (t.id === id ? { ...t, visible: false } : t))
      );
    }, 5000);
    
    return id;
  }, []);

  const dismiss = useCallback((toastId?: string) => {
    setToasts((toasts) =>
      toasts.map((t) =>
        toastId === undefined || t.id === toastId ? { ...t, visible: false } : t
      )
    );
  }, []);

  return {
    toast,
    dismiss,
    toasts: toasts.filter((t) => t.visible),
  };
}

// 인터페이스 정의를 추가하여 AuthForm에서 사용할 수 있게 합니다
export interface Toast extends ToastProps {
  id: string;
}

export { toast } from "sonner";
