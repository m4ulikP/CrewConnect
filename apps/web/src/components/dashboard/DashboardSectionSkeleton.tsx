import React from "react";

interface DashboardSectionSkeletonProps {
  rows?: number;
  label?: string;
}

export const DashboardSectionSkeleton: React.FC<DashboardSectionSkeletonProps> = ({
  rows = 3,
  label = "Loading section",
}) => {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-md border border-border-subtle bg-surface-tonal/70 p-3.5 space-y-2"
        >
          <div className="h-4 w-2/5 rounded bg-surface-tonal" />
          <div className="h-3 w-3/4 rounded bg-surface-tonal" />
        </div>
      ))}
    </div>
  );
};
