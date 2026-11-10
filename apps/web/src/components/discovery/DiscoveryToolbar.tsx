import React, { useState } from "react";
import { Filter, Plus, Search, X } from "lucide-react";
import type { HackathonRecord } from "../../lib/api";

interface DiscoveryToolbarProps {
  hackathons: HackathonRecord[];
  selectedHackathonId: string;
  onSelectHackathon: (hackathonId: string) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  hasVacancies: boolean;
  onToggleVacancies: () => void;
  selectedSkills: string[];
  suggestedSkills: string[];
  onToggleSkill: (skill: string) => void;
  onAddCustomSkill: (skill: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export const DiscoveryToolbar: React.FC<DiscoveryToolbarProps> = ({
  hackathons,
  selectedHackathonId,
  onSelectHackathon,
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  onClearSearch,
  hasVacancies,
  onToggleVacancies,
  selectedSkills,
  suggestedSkills,
  onToggleSkill,
  onAddCustomSkill,
  onResetFilters,
  hasActiveFilters,
}) => {
  const [customSkillInput, setCustomSkillInput] = useState("");
  const activeHackathon = hackathons.find((h) => h.id === selectedHackathonId);

  const visibleSkillChips = Array.from(new Set([...selectedSkills, ...suggestedSkills])).slice(
    0,
    8
  );

  const handleCustomSkillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customSkillInput.trim();
    if (!cleaned) return;
    onAddCustomSkill(cleaned);
    setCustomSkillInput("");
  };

  return (
    <section
      aria-label="Directory search and filters"
      className="bg-surface border border-border-subtle rounded-lg p-4 space-y-3"
    >
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center">
        {/* Hackathon Scope Selector or Readout */}
        {hackathons.length > 1 ? (
          <div className="lg:w-52 flex-shrink-0">
            <label htmlFor="hackathon-filter" className="sr-only">
              Filter by hackathon
            </label>
            <select
              id="hackathon-filter"
              aria-label="Filter by hackathon"
              value={selectedHackathonId}
              onChange={(e) => onSelectHackathon(e.target.value)}
              className="form-input h-10 text-[13px] font-medium bg-surface-hover"
            >
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title}
                </option>
              ))}
            </select>
          </div>
        ) : activeHackathon ? (
          <div className="inline-flex items-center gap-2 px-3 h-10 rounded-md bg-surface-tonal border border-border-subtle text-xs text-ink-primary font-medium flex-shrink-0">
            <span className="truncate max-w-[200px]">{activeHackathon.title}</span>
            <span className="text-ink-muted tabular">
              {activeHackathon.minTeamSize}-{activeHackathon.maxTeamSize} seats
            </span>
          </div>
        ) : null}

        {/* Debounced Team Name / Tagline Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
          className="relative flex-1 min-w-0"
          role="search"
        >
          <label htmlFor="directory-search" className="sr-only">
            Search teams by name or tagline
          </label>
          <Search
            className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="directory-search"
            type="search"
            placeholder="Search name or tagline..."
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            className="form-input h-10 !pl-9 !pr-9 text-[13px]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={onClearSearch}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-ink-muted hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Vacancies Filter & Custom Skill Entry */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleVacancies}
            aria-pressed={hasVacancies}
            className={`btn text-[13px] h-10 px-3.5 whitespace-nowrap ${
              hasVacancies
                ? "bg-ink-primary text-surface border-ink-primary hover:bg-[#27272A]"
                : "btn-secondary"
            }`}
          >
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Vacancies Only</span>
          </button>

          <form
            onSubmit={handleCustomSkillSubmit}
            className="flex items-center gap-1.5 flex-1 sm:flex-initial"
          >
            <label htmlFor="skill-filter-input" className="sr-only">
              Add skill tag filter
            </label>
            <input
              id="skill-filter-input"
              type="text"
              value={customSkillInput}
              onChange={(e) => setCustomSkillInput(e.target.value)}
              placeholder="Skill tag..."
              className="form-input h-10 w-full sm:w-32 text-[13px] px-2.5"
            />
            <button
              type="submit"
              disabled={!customSkillInput.trim()}
              aria-label="Add skill filter"
              className="btn btn-secondary h-10 px-3 text-[13px] flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Skill</span>
            </button>
          </form>
        </div>
      </div>

      {/* Skill Quick Filters & Active Filter Reset */}
      {(visibleSkillChips.length > 0 || hasActiveFilters) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted mr-1">Skills sought:</span>
            {visibleSkillChips.map((skill) => {
              const active = selectedSkills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => onToggleSkill(skill)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-sm border transition-colors cursor-pointer ${
                    active
                      ? "bg-accent text-ink-on-accent border-accent font-medium"
                      : "bg-surface-tonal text-ink-secondary border-border-subtle hover:border-border-control hover:text-ink-primary"
                  }`}
                >
                  <span>{skill}</span>
                  {active && <X className="w-3 h-3" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-xs font-medium text-accent hover:underline cursor-pointer whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </section>
  );
};
