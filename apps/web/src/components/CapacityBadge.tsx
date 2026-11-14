import React from "react";

interface CapacityBadgeProps {
  memberCount: number;
  maxCapacity: number;
  isOpen?: boolean;
  variant?: "badge" | "indicator";
}

export const CapacityBadge: React.FC<CapacityBadgeProps> = ({
  memberCount,
  maxCapacity,
  isOpen = true,
  variant = "badge",
}) => {
  const isFull = memberCount >= maxCapacity;
  const remaining = Math.max(0, maxCapacity - memberCount);

  if (variant === "indicator") {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`status-label ${
            isFull ? "status-full" : remaining === 1 ? "status-warning" : "status-open"
          }`}
        >
          <span className="tabular">{memberCount}</span> /{" "}
          <span className="tabular">{maxCapacity}</span> filled
        </span>
        <span className="text-xs text-ink-secondary tabular">
          {isFull ? "Roster full" : `${remaining} seat${remaining === 1 ? "" : "s"} open`}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`text-[11px] font-medium px-2.5 py-1 rounded-sm border tabular ${
        !isFull && isOpen
          ? "bg-accent-tint text-accent border-[#C5E0DC]"
          : "bg-surface-tonal text-ink-secondary border-border-subtle"
      }`}
    >
      {memberCount} / {maxCapacity} seats
    </span>
  );
};
