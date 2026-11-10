import React from "react";
import { Lock, ShieldCheck } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-chrome py-10 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between text-[13px] text-ink-secondary gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0" />
          <span className="font-medium text-ink-primary">
            CrewConnect Platform — Hack4Hack Crew Hiring Challenge 2026
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-accent" />
            <span>Atomic Seat Reservation</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Zero Oversubscription</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
