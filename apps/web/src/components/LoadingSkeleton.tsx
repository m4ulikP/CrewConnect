import React from "react";

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-16 bg-slate-900 border border-slate-800 rounded-xl w-full" />
      ))}
    </div>
  );
};
