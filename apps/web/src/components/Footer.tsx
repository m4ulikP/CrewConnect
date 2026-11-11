import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-chrome border-t-2 border-ink-primary py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[13px] gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent border border-ink-primary flex-shrink-0" />
          <span className="font-display font-bold text-sm text-ink-primary">
            CrewConnect — Hack4Hack Crew Hiring Challenge 2026
          </span>
        </div>
        <span className="text-ink-secondary font-medium">
          Atomic seat reservations · Zero oversubscription
        </span>
      </div>
    </footer>
  );
};
