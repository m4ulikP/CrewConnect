import React from "react";

interface SeatSlotStripProps {
  memberCount: number;
  maxCapacity: number;
  isOpen: boolean;
  compact?: boolean;
}

/**
 * Deterministic architectural seat-slot meter showing server-confirmed occupancy
 * against total squad capacity.
 */
export const SeatSlotStrip: React.FC<SeatSlotStripProps> = ({
  memberCount,
  maxCapacity,
  isOpen,
  compact = false,
}) => {
  const safeMax = Math.max(1, maxCapacity);
  const safeFilled = Math.min(safeMax, Math.max(0, memberCount));
  const remaining = Math.max(0, safeMax - safeFilled);
  const isFull = safeFilled >= safeMax;

  return (
    <div
      className="flex items-center gap-2.5"
      aria-label={`${safeFilled} of ${safeMax} seats filled, ${remaining} open`}
    >
      <div className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: Math.min(safeMax, 8) }).map((_, idx) => {
          const isOccupied = idx < safeFilled;
          return (
            <span
              key={idx}
              className={`inline-block rounded-[2px] border transition-colors ${
                compact ? "w-2.5 h-2.5" : "w-3.5 h-3.5"
              } ${
                isOccupied
                  ? isFull
                    ? "bg-ink-primary border-ink-primary"
                    : "bg-accent border-accent"
                  : isOpen
                    ? "bg-surface border-border-control border-dashed"
                    : "bg-surface-tonal border-border-strong"
              }`}
            />
          );
        })}
        {safeMax > 8 && (
          <span className="text-[11px] text-ink-muted tabular ml-0.5">+{safeMax - 8}</span>
        )}
      </div>

      {!compact && (
        <span className="text-xs text-ink-secondary tabular">
          {isFull ? "Full roster" : !isOpen ? "Paused" : `${remaining} open`}
        </span>
      )}
    </div>
  );
};
