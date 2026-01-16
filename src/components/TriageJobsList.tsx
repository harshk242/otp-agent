import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";

interface TriageJobsListProps {
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TriageJobsList({
  selectedJobId,
  onSelectJob,
}: TriageJobsListProps) {
  const jobs = useQuery(api.triage.listTriageJobs, {});

  if (!jobs) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Loading jobs...</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
        <p>No triage jobs yet.</p>
        <p>Start a new triage to see results here.</p>
      </div>
    );
  }

  return (
    <div className="job-list">
      {jobs.map((job: Doc<"triageJobs">) => (
        <div
          key={job._id}
          className={`job-item ${selectedJobId === job._id ? "selected" : ""}`}
          onClick={() => onSelectJob(job._id)}
        >
          <div className="job-disease">{job.diseaseName}</div>
          <div className="job-meta">
            <span>{job.genes.length} targets</span>
            <span
              className={`badge badge-${job.status.toLowerCase()}`}
            >
              {job.status}
            </span>
          </div>
          <div className="job-meta" style={{ marginTop: "0.25rem" }}>
            <span>{formatDate(job.startedAt)}</span>
            {job.status === "RUNNING" && (
              <span>{job.progress}%</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
