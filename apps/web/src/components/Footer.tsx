import React from "react";
import { Lock, ShieldCheck } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border-subtle bg-chrome/50 py-10 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-ink-muted gap-4">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span className="font-medium text-ink-secondary">
            CrewConnect Platform — Built for Hack4Hack Crew Hiring Challenge 2026
          </span>
        </div>
        <div className="flex items-center space-x-6">
          <span className="flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5 text-accent" />
            <span>Race-Proof Serialization</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Zero Oversaturation</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
