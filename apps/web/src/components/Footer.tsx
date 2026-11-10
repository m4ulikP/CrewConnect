import React from "react";
import { Lock, ShieldCheck } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-chrome border-t-2 border-ink-primary py-10 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between text-[13px] gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-accent border border-ink-primary flex-shrink-0" />
          <span className="font-display font-bold text-sm text-ink-primary">
            CrewConnect Platform — Hack4Hack Crew Hiring Challenge 2026
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-ink-primary font-medium">
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-accent" />
            <span>Atomic Seat Reservation</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-tangelo" />
            <span>Zero Oversubscription</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
