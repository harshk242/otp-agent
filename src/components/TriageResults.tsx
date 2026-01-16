import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import TargetReportDetail from "./TargetReportDetail";

interface TriageResultsProps {
  jobId: string;
}

type Verdict = "GO" | "GO_WITH_CAUTION" | "INVESTIGATE_FURTHER" | "NO_GO";

function getVerdictBadgeClass(verdict: Verdict): string {
  switch (verdict) {
    case "GO":
      return "badge-go";
    case "GO_WITH_CAUTION":
      return "badge-caution";
    case "INVESTIGATE_FURTHER":
      return "badge-investigate";
    case "NO_GO":
      return "badge-nogo";
  }
}

function getVerdictEmoji(verdict: Verdict): string {
  switch (verdict) {
    case "GO":
      return "✅";
    case "GO_WITH_CAUTION":
      return "⚠️";
    case "INVESTIGATE_FURTHER":
      return "🔍";
    case "NO_GO":
      return "❌";
  }
}

export default function TriageResults({ jobId }: TriageResultsProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<Verdict | "ALL">("ALL");

  const data = useQuery(api.triage.getFullTriageData, {
    triageJobId: jobId as Id<"triageJobs">,
  });

  if (!data) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Loading results...</span>
      </div>
    );
  }

  const { job, targetReports, triageReport } = data;

  if (!job) {
    return <div>Job not found</div>;
  }

  // Filter reports by verdict
  const filteredReports =
    filterVerdict === "ALL"
      ? targetReports
      : targetReports.filter((r: Doc<"targetReports">) => r.verdict === filterVerdict);

  // Sort by composite score (descending)
  const sortedReports = [...filteredReports].sort(
    (a, b) => b.scores.compositeScore - a.scores.compositeScore
  );

  // If viewing a specific report
  if (selectedReportId) {
    const report = targetReports.find((r: Doc<"targetReports">) => r._id === selectedReportId);
    if (report) {
      return (
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => setSelectedReportId(null)}
            style={{ marginBottom: "1rem" }}
          >
            ← Back to Results
          </button>
          <TargetReportDetail report={report} />
        </div>
      );
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2>{job.diseaseName}</h2>
        <p style={{ color: "#64748b" }}>
          {job.genes.length} targets analyzed •{" "}
          {job.status === "COMPLETED"
            ? `Completed on ${new Date(job.completedAt || 0).toLocaleDateString()}`
            : job.status}
        </p>
      </div>

      {/* Summary */}
      {triageReport?.summary && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Summary</h3>
          <div className="score-grid">
            <div className="score-item">
              <div className="score-value" style={{ color: "#22c55e" }}>
                {triageReport.summary.goCount}
              </div>
              <div className="score-label">GO</div>
            </div>
            <div className="score-item">
              <div className="score-value" style={{ color: "#f59e0b" }}>
                {triageReport.summary.cautionCount}
              </div>
              <div className="score-label">Caution</div>
            </div>
            <div className="score-item">
              <div className="score-value" style={{ color: "#6366f1" }}>
                {triageReport.summary.investigateCount}
              </div>
              <div className="score-label">Investigate</div>
            </div>
            <div className="score-item">
              <div className="score-value" style={{ color: "#ef4444" }}>
                {triageReport.summary.noGoCount}
              </div>
              <div className="score-label">No Go</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
        <button
          className={`btn ${filterVerdict === "ALL" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilterVerdict("ALL")}
        >
          All ({targetReports.length})
        </button>
        <button
          className={`btn ${filterVerdict === "GO" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilterVerdict("GO")}
        >
          ✅ GO
        </button>
        <button
          className={`btn ${filterVerdict === "GO_WITH_CAUTION" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilterVerdict("GO_WITH_CAUTION")}
        >
          ⚠️ Caution
        </button>
        <button
          className={`btn ${filterVerdict === "INVESTIGATE_FURTHER" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilterVerdict("INVESTIGATE_FURTHER")}
        >
          🔍 Investigate
        </button>
        <button
          className={`btn ${filterVerdict === "NO_GO" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilterVerdict("NO_GO")}
        >
          ❌ No Go
        </button>
      </div>

      {/* Target list */}
      <div className="target-list">
        {sortedReports.map((report) => (
          <div
            key={report._id}
            className="target-item"
            onClick={() => setSelectedReportId(report._id)}
          >
            <div>
              <span className="target-symbol">{report.targetInfo.symbol}</span>
              <span
                style={{
                  marginLeft: "0.75rem",
                  color: "#64748b",
                  fontSize: "0.875rem",
                }}
              >
                {report.targetInfo.name}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span className="target-score">
                {(report.scores.compositeScore * 100).toFixed(0)}%
              </span>
              <span className={`badge ${getVerdictBadgeClass(report.verdict as Verdict)}`}>
                {getVerdictEmoji(report.verdict as Verdict)}{" "}
                {report.verdict.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {sortedReports.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
          No targets match the selected filter.
        </div>
      )}
    </div>
  );
}
