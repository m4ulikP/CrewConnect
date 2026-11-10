import React from "react";
import type { LucideIcon } from "lucide-react";

interface DashboardEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  children,
}) => {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface-hover p-6 text-center space-y-3">
      <div className="w-10 h-10 rounded-md bg-surface-tonal border border-border-subtle text-ink-secondary flex items-center justify-center mx-auto">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-ink-primary">{title}</h3>
        <p className="text-[13px] text-ink-secondary max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {children && (
        <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">{children}</div>
      )}
    </div>
  );
};
