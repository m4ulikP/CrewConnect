import React from "react";
import { Terminal, Lock, CheckCircle2 } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-900 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span>CrewConnect Platform — Built for Hack4Hack Crew Hiring Challenge 2026</span>
        </div>
        <div className="flex items-center space-x-6">
          <span className="flex items-center space-x-1">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Race-Proof Serialization</span>
          </span>
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero Oversaturation</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
