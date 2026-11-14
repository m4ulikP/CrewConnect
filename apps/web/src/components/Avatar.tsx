import React from "react";

interface AvatarProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const PALETTES = ["av-pine", "av-ochre", "av-slate", "av-clay", "av-moss"] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "U";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

export const Avatar: React.FC<AvatarProps> = ({ name, className = "", size = "md" }) => {
  const initials = getInitials(name);
  const palette = getPalette(name);

  const sizeClasses =
    size === "sm"
      ? "w-6 h-6 text-[11px]"
      : size === "lg"
        ? "w-10 h-10 text-sm font-bold"
        : "w-8 h-8 text-[13px]";

  return (
    <div className={`avatar ${palette} ${sizeClasses} ${className}`} title={name} aria-label={name}>
      {initials}
    </div>
  );
};
