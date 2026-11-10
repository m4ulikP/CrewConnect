import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DirectoryPaginationProps {
  page: number;
  limit: number;
  total: number;
  visibleCount: number;
  onPageChange: (nextPage: number) => void;
}

export const DirectoryPagination: React.FC<DirectoryPaginationProps> = ({
  page,
  limit,
  total,
  visibleCount,
  onPageChange,
}) => {
  const safeTotal = Math.max(total, visibleCount);
  const totalPages = Math.max(1, Math.ceil(safeTotal / Math.max(1, limit)));

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Directory pagination"
      className="flex items-center justify-between gap-3 pt-2 border-t border-border-subtle text-xs"
    >
      <span className="text-ink-secondary tabular">
        Page {page} of {totalPages} · {safeTotal} total
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="btn btn-secondary h-8 px-2.5 text-xs"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Previous</span>
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="btn btn-secondary h-8 px-2.5 text-xs"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};
