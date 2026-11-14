import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Github,
  Linkedin,
  Globe,
  AlertCircle,
  RefreshCw,
  UserPlus,
  Compass,
  ShieldCheck,
} from "lucide-react";
import { apiGetTeamRecommendations, ApiClientError, type TeamRecord } from "../../lib/api";
import type {
  TeammateRecommendationDTO,
  TimezoneCompatibilityLabel,
  ExperienceLevel,
} from "@crewconnect/shared";
import { Avatar } from "../Avatar";

interface WorkspaceRecommendationsTabProps {
  team: TeamRecord;
  isLeader: boolean;
  onOpenInviteModal?: (prefillInviteeId?: string) => void;
}

function getTimezoneBadge(label: TimezoneCompatibilityLabel) {
  switch (label) {
    case "STRONG":
      return {
        badgeClass: "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]",
        label: "Strong Overlap",
      };
    case "MODERATE":
      return {
        badgeClass: "bg-[#FEF9C3] text-[#A16207] border-[#FEF08A]",
        label: "Moderate Overlap",
      };
    case "LIMITED":
      return {
        badgeClass: "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]",
        label: "Limited Overlap",
      };
    case "MINIMAL":
      return {
        badgeClass: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
        label: "Minimal Overlap",
      };
    case "UNKNOWN":
    default:
      return {
        badgeClass: "bg-surface-tonal text-ink-secondary border-border-subtle",
        label: "Timezone Unlisted",
      };
  }
}

function getExperienceBadge(level?: ExperienceLevel) {
  switch (level) {
    case "ADVANCED":
      return "bg-[#E0E7FF] text-[#4338CA] border-[#C7D2FE]";
    case "INTERMEDIATE":
      return "bg-[#CCFBF1] text-[#0F766E] border-[#99F6E4]";
    case "BEGINNER":
      return "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]";
    default:
      return "bg-surface-tonal text-ink-muted border-border-subtle";
  }
}

function getScoreTheme(score: number) {
  if (score >= 80) {
    return {
      pillClass: "bg-[#115E59] text-white border-[#0D4D49]",
      labelClass: "text-[#115E59]",
      barClass: "bg-[#115E59]",
    };
  }
  if (score >= 60) {
    return {
      pillClass: "bg-[#D97706] text-white border-[#B45309]",
      labelClass: "text-[#D97706]",
      barClass: "bg-[#D97706]",
    };
  }
  return {
    pillClass: "bg-ink-muted text-white border-border-strong",
    labelClass: "text-ink-secondary",
    barClass: "bg-ink-muted",
  };
}

export const WorkspaceRecommendationsTab: React.FC<WorkspaceRecommendationsTabProps> = ({
  team,
  isLeader,
  onOpenInviteModal,
}) => {
  const [recommendations, setRecommendations] = useState<TeammateRecommendationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [vacancies, setVacancies] = useState(Math.max(0, team.maxCapacity - team.memberCount));

  const fetchRecommendations = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiGetTeamRecommendations(team.id, targetPage, 6);
        setRecommendations(response.data.recommendations || []);
        setVacancies(response.data.vacancies);
        setPage(response.meta?.page || targetPage);
        const total = response.meta?.total || 0;
        setTotalCandidates(total);
        setTotalPages(Math.max(1, Math.ceil(total / 6)));
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError("Unable to calculate recommendations. Please check connection and retry.");
        }
      } finally {
        setLoading(false);
      }
    },
    [team.id]
  );

  useEffect(() => {
    fetchRecommendations(1);
  }, [fetchRecommendations]);

  const isSquadFull = vacancies === 0 || team.memberCount >= team.maxCapacity;

  return (
    <div className="space-y-6">
      {/* Editorial Header Card */}
      <div className="bg-surface border border-border-subtle rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[#CCFBF1] text-[#115E59]">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-ink-primary tracking-tight">
                Teammate Recommendations
              </h2>
            </div>
            <p className="text-xs sm:text-[13px] text-ink-secondary leading-relaxed max-w-2xl">
              Transparent, deterministic matching prioritizing skill complementarity, experience
              distribution, and timezone overlap for{" "}
              <span className="font-medium text-ink-primary">{team.name}</span>.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="px-3 py-1.5 rounded bg-surface-tonal border border-border-subtle text-right">
              <span className="text-[10px] uppercase font-bold text-ink-muted tracking-wider block">
                Open Vacancies
              </span>
              <span className="text-sm font-semibold text-ink-primary tabular">
                {vacancies} {vacancies === 1 ? "seat" : "seats"} left
              </span>
            </div>

            <button
              type="button"
              onClick={() => fetchRecommendations(page)}
              disabled={loading}
              aria-label="Refresh teammate recommendations"
              className="btn btn-secondary h-9 px-3 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Squad Requirements Readout */}
        <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-muted font-medium">Desired Squad Skills:</span>
          {team.skillsNeeded && team.skillsNeeded.length > 0 ? (
            team.skillsNeeded.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]"
              >
                {skill}
              </span>
            ))
          ) : (
            <span className="text-ink-secondary italic text-[11px]">
              No specific skills declared — matching on general technical breadth and complementary
              stack.
            </span>
          )}
        </div>
      </div>

      {/* Full Squad Alert */}
      {isSquadFull && (
        <div
          role="status"
          className="p-4 rounded-lg bg-surface-tonal border border-border-subtle flex items-start gap-3 text-xs text-ink-secondary"
        >
          <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-semibold text-ink-primary">
              Squad has reached full capacity ({team.memberCount}/{team.maxCapacity})
            </p>
            <p>
              Your squad currently has no open seats. You can review potential future teammates or
              open additional seats in Squad Settings if capacity permits.
            </p>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-danger-bg border border-[#FCA5A5] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-danger"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchRecommendations(page)}
            className="btn btn-secondary h-8 px-3 text-xs self-start sm:self-auto"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div
          role="status"
          aria-label="Loading teammate recommendations"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-tonal" />
                  <div className="space-y-1.5">
                    <div className="w-32 h-4 bg-surface-tonal rounded" />
                    <div className="w-20 h-3 bg-surface-tonal rounded" />
                  </div>
                </div>
                <div className="w-16 h-7 bg-surface-tonal rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="w-full h-3 bg-surface-tonal rounded" />
                <div className="w-4/5 h-3 bg-surface-tonal rounded" />
              </div>
              <div className="flex gap-2">
                <div className="w-16 h-6 bg-surface-tonal rounded" />
                <div className="w-20 h-6 bg-surface-tonal rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && recommendations.length === 0 && (
        <div
          data-testid="recommendations-empty-state"
          className="bg-surface border border-border-subtle rounded-lg p-10 text-center space-y-3"
        >
          <div className="w-12 h-12 rounded-full bg-surface-tonal text-ink-secondary flex items-center justify-center mx-auto">
            <Compass className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-ink-primary">No Eligible Candidates Found</h3>
          <p className="text-xs text-ink-secondary max-w-md mx-auto leading-relaxed">
            All registered participants in this hackathon are already confirmed squad members or
            have pending commitments. Check back as new participants register!
          </p>
        </div>
      )}

      {/* Recommendations Cards Grid */}
      {!loading && !error && recommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-ink-secondary">
            <span>
              Showing {recommendations.length} of {totalCandidates} eligible candidate
              {totalCandidates === 1 ? "" : "s"}
            </span>
            <span className="text-[11px] text-ink-muted">
              Sorted deterministically by compatibility score
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec) => {
              const { candidate, compatibilityScore, dimensionScores, explanations } = rec;
              const theme = getScoreTheme(compatibilityScore);
              const tzBadge = getTimezoneBadge(explanations.timezoneFit.label);

              return (
                <div
                  key={candidate.id}
                  data-testid="recommendation-card"
                  className="bg-surface border border-border-subtle hover:border-border-strong rounded-lg p-5 flex flex-col justify-between space-y-4 transition-all"
                >
                  <div className="space-y-3.5">
                    {/* Card Top: Identity & Overall Compatibility Score */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={candidate.displayName} size="md" />
                        <div className="min-w-0 space-y-0.5">
                          <h4 className="text-sm font-semibold text-ink-primary truncate">
                            {candidate.displayName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            {candidate.experienceLevel && (
                              <span
                                className={`px-1.5 py-0.2 rounded border font-medium ${getExperienceBadge(
                                  candidate.experienceLevel
                                )}`}
                              >
                                {candidate.experienceLevel}
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.2 rounded border font-medium ${tzBadge.badgeClass}`}
                            >
                              {tzBadge.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Overall Compatibility Score Pill */}
                      <div
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-xs shrink-0 flex items-center gap-1 ${theme.pillClass}`}
                        aria-label={`Overall Compatibility Score: ${compatibilityScore} percent`}
                      >
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        <span>{compatibilityScore}% Match</span>
                      </div>
                    </div>

                    {/* Bio if available */}
                    {candidate.bio && (
                      <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed">
                        {candidate.bio}
                      </p>
                    )}

                    {/* Narrative Explanation */}
                    <div className="p-3 rounded-md bg-surface-tonal border border-border-subtle text-xs space-y-1.5">
                      <p className="text-ink-primary font-medium leading-snug">
                        {explanations.summary}
                      </p>
                      <div className="text-[11px] text-ink-secondary flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-ink-muted shrink-0" aria-hidden="true" />
                        <span>{explanations.timezoneFit.description}</span>
                      </div>
                    </div>

                    {/* Skill Contributions & Overlap */}
                    <div className="space-y-1.5 text-xs">
                      {explanations.complementarySkills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[#0F766E]">Adds:</span>
                          {explanations.complementarySkills.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{skill}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {explanations.overlappingSkills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-ink-muted">Shared:</span>
                          {explanations.overlappingSkills.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 rounded text-[11px] font-normal bg-surface-tonal text-ink-secondary border border-border-subtle"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dimension Breakdown Bar */}
                    <div className="pt-2 border-t border-border-subtle grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div className="space-y-0.5">
                        <span className="text-ink-muted block font-medium">Skills (50%)</span>
                        <span className="font-semibold text-ink-primary">
                          {dimensionScores.skillScore}%
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-ink-muted block font-medium">Experience (25%)</span>
                        <span className="font-semibold text-ink-primary">
                          {dimensionScores.experienceScore}%
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-ink-muted block font-medium">Timezone (25%)</span>
                        <span className="font-semibold text-ink-primary">
                          {dimensionScores.timezoneScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Social Links & Invite Action */}
                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                    {/* External links */}
                    <div className="flex items-center gap-2 text-ink-muted">
                      {candidate.githubUrl && (
                        <a
                          href={candidate.githubUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={`${candidate.displayName}'s GitHub profile`}
                          className="hover:text-ink-primary transition-colors p-1"
                        >
                          <Github className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {candidate.linkedinUrl && (
                        <a
                          href={candidate.linkedinUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={`${candidate.displayName}'s LinkedIn profile`}
                          className="hover:text-ink-primary transition-colors p-1"
                        >
                          <Linkedin className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {candidate.portfolioUrl && (
                        <a
                          href={candidate.portfolioUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={`${candidate.displayName}'s portfolio site`}
                          className="hover:text-ink-primary transition-colors p-1"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Invite Action: Leader only */}
                    {isLeader && onOpenInviteModal ? (
                      <button
                        type="button"
                        onClick={() => onOpenInviteModal(candidate.id)}
                        disabled={isSquadFull}
                        className="btn btn-primary h-8 px-3 text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Invite to Squad</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-ink-muted italic">Leader can invite</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border-subtle text-xs">
              <button
                type="button"
                onClick={() => fetchRecommendations(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                className="btn btn-secondary h-8 px-3 text-xs disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-ink-secondary font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => fetchRecommendations(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || loading}
                className="btn btn-secondary h-8 px-3 text-xs disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
