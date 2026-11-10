import React from "react";

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading directory">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="rounded-lg border border-border-subtle bg-surface p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-44 rounded bg-surface-tonal" />
              <div className="h-3 w-3/4 rounded bg-surface-tonal" />
            </div>
            <div className="h-6 w-20 rounded bg-surface-tonal flex-shrink-0" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="h-5 w-16 rounded bg-surface-tonal" />
            <div className="h-5 w-14 rounded bg-surface-tonal" />
          </div>
        </div>
      ))}
    </div>
  );
};
