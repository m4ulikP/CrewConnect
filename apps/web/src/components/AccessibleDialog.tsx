import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface AccessibleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId?: string;
  allowClose?: boolean;
  role?: "dialog" | "alertdialog";
  maxWidthClass?: string;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  isOpen,
  onClose,
  titleId,
  descriptionId,
  allowClose = true,
  role = "dialog",
  maxWidthClass = "max-w-md",
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const allowCloseRef = useRef(allowClose);

  onCloseRef.current = onClose;
  allowCloseRef.current = allowClose;

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const rootEl = document.getElementById("root");
    const hadInert = rootEl?.hasAttribute("inert") ?? false;
    const prevAriaHidden = rootEl?.getAttribute("aria-hidden") ?? null;
    if (rootEl) {
      rootEl.setAttribute("aria-hidden", "true");
      rootEl.setAttribute("inert", "");
    }

    const focusTimer = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length > 0) {
        // Prefer focusing the first non-close interactive control (e.g. input) or first button
        const preferred =
          focusable.find((el) => el.tagName !== "BUTTON") ||
          focusable.find((el) => !el.getAttribute("aria-label")?.toLowerCase().includes("close")) ||
          focusable[0];
        preferred.focus();
      } else {
        container.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (allowCloseRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === "Tab") {
        const container = containerRef.current;
        if (!container) return;
        const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !container.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !container.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = prevOverflow;

      if (rootEl) {
        if (prevAriaHidden === null) {
          rootEl.removeAttribute("aria-hidden");
        } else {
          rootEl.setAttribute("aria-hidden", prevAriaHidden);
        }
        if (!hadInert) {
          rootEl.removeAttribute("inert");
        }
      }

      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/40 pane-enter"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && allowClose) {
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`relative w-full ${maxWidthClass} bg-surface border border-border-strong rounded-lg overflow-hidden outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
