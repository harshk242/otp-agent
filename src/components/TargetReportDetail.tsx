interface SafetySignal {
  signalType: string;
  organSystem?: string;
  severity: string;
  description: string;
  evidence: Array<{
    type: string;
    source: string;
    description: string;
    url?: string;
  }>;
  investigationSummary?: string;
}

interface TargetReport {
  targetInfo: {
    ensemblId: string;
    symbol: string;
    name: string;
    biotype?: string;
    description?: string;
    chromosome?: string;
  };
  diseaseId: string;
  diseaseName: string;
  associationScore?: {
    overallScore: number;
    geneticAssociation: number;
    somaticMutation: number;
    knownDrug: number;
    affectedPathway: number;
    literature: number;
    rnaExpression: number;
    animalModel: number;
  };
  tractability?: {
    smallMolecule?: { isAssessed: boolean; buckets: string[] };
    antibody?: { isAssessed: boolean; buckets: string[] };
    protac?: { isAssessed: boolean; buckets: string[] };
  };
  safetySignals: SafetySignal[];
  competitorLandscape?: {
    totalTrials: number;
    activeTrials: number;
    completedTrials: number;
    failedTrials: number;
    competitiveRiskScore: number;
    landscapeSummary?: string;
  };
  knownDrugs?: Array<{
    drugId: string;
    drugName: string;
    phase?: string;
    status?: string;
    mechanismOfAction?: string;
  }>;
  scores: {
    geneticEvidence: number;
    tractability: number;
    safetyRisk: number;
    competitiveLandscape: number;
    compositeScore: number;
  };
  verdict: string;
  recommendations: string[];
}

interface TargetReportDetailProps {
  report: TargetReport;
}

function getSeverityClass(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MODERATE":
      return "moderate";
    default:
      return "low";
  }
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const percentage = value * 100;
  const color =
    percentage >= 60
      ? "#22c55e"
      : percentage >= 40
        ? "#f59e0b"
        : percentage >= 20
          ? "#f97316"
          : "#ef4444";

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.25rem",
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{percentage.toFixed(0)}%</span>
      </div>
      <div
        style={{
          height: "8px",
          background: "#e2e8f0",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: color,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

export default function TargetReportDetail({ report }: TargetReportDetailProps) {
  return (
    <div>
      {/* Header */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2 style={{ marginBottom: "0.25rem" }}>{report.targetInfo.symbol}</h2>
            <p style={{ color: "#64748b" }}>{report.targetInfo.name}</p>
            <p style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
              {report.targetInfo.ensemblId} • {report.targetInfo.biotype}
              {report.targetInfo.chromosome &&
                ` • Chr ${report.targetInfo.chromosome}`}
            </p>
          </div>
          <span
            className={`badge badge-${report.verdict.toLowerCase().replace(/_/g, "")}`}
            style={{ fontSize: "1rem", padding: "0.5rem 1rem" }}
          >
            {report.verdict.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Scores */}
      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginBottom: "1rem" }}>Score Breakdown</h3>
        <div
          style={{
            background: "#f0f9ff",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1.5rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", fontWeight: 700, color: "#3b82f6" }}>
            {(report.scores.compositeScore * 100).toFixed(0)}%
          </div>
          <div style={{ color: "#64748b" }}>Composite Score</div>
        </div>

        <ScoreBar
          value={report.scores.geneticEvidence}
          label="Genetic Evidence"
        />
        <ScoreBar value={report.scores.tractability} label="Tractability" />
        <ScoreBar
          value={1 - report.scores.safetyRisk}
          label="Safety (inverted)"
        />
        <ScoreBar
          value={1 - report.scores.competitiveLandscape}
          label="Competitive (inverted)"
        />
      </div>

      {/* Association Scores */}
      {report.associationScore && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Disease Association</h3>
          <p style={{ marginBottom: "0.5rem" }}>
            <strong>Disease:</strong> {report.diseaseName}
          </p>
          <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#64748b" }}>
            <strong>Disease ID:</strong> {report.diseaseId}
          </p>
          <div className="score-grid">
            <div className="score-item">
              <div className="score-value">
                {(report.associationScore.overallScore * 100).toFixed(0)}%
              </div>
              <div className="score-label">Overall</div>
            </div>
            <div className="score-item">
              <div className="score-value">
                {(report.associationScore.geneticAssociation * 100).toFixed(0)}%
              </div>
              <div className="score-label">Genetic</div>
            </div>
            <div className="score-item">
              <div className="score-value">
                {(report.associationScore.literature * 100).toFixed(0)}%
              </div>
              <div className="score-label">Literature</div>
            </div>
            <div className="score-item">
              <div className="score-value">
                {(report.associationScore.animalModel * 100).toFixed(0)}%
              </div>
              <div className="score-label">Animal Model</div>
            </div>
          </div>
        </div>
      )}

      {/* Tractability */}
      {report.tractability && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Tractability</h3>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {report.tractability.smallMolecule?.isAssessed && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#dcfce7",
                  borderRadius: "8px",
                }}
              >
                ✅ Small Molecule
              </div>
            )}
            {report.tractability.antibody?.isAssessed && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#dcfce7",
                  borderRadius: "8px",
                }}
              >
                ✅ Antibody
              </div>
            )}
            {report.tractability.protac?.isAssessed && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#dcfce7",
                  borderRadius: "8px",
                }}
              >
                ✅ PROTAC
              </div>
            )}
            {!report.tractability.smallMolecule?.isAssessed &&
              !report.tractability.antibody?.isAssessed &&
              !report.tractability.protac?.isAssessed && (
                <div style={{ color: "#64748b" }}>
                  No modalities assessed as tractable
                </div>
              )}
          </div>
        </div>
      )}

      {/* Safety Signals */}
      {report.safetySignals.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>
            Safety Signals ({report.safetySignals.length})
          </h3>
          {report.safetySignals.map((signal, idx) => (
            <div
              key={idx}
              className={`safety-signal ${getSeverityClass(signal.severity)}`}
            >
              <div className="safety-signal-header">
                <span className="safety-signal-type">
                  {signal.signalType}
                  {signal.organSystem && ` (${signal.organSystem})`}
                </span>
                <span className="badge">{signal.severity}</span>
              </div>
              <p className="safety-signal-description">{signal.description}</p>
              {signal.investigationSummary && (
                <p
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "0.875rem",
                    fontStyle: "italic",
                  }}
                >
                  {signal.investigationSummary}
                </p>
              )}
              {signal.evidence.length > 0 && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                  <strong>Evidence:</strong>
                  <ul style={{ marginLeft: "1rem", marginTop: "0.25rem" }}>
                    {signal.evidence.slice(0, 3).map((e, i) => (
                      <li key={i}>
                        [{e.type}] {e.description.slice(0, 100)}...
                        {e.url && (
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginLeft: "0.5rem" }}
                          >
                            Link
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Competitor Landscape */}
      {report.competitorLandscape && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Competitive Landscape</h3>
          <div className="score-grid">
            <div className="score-item">
              <div className="score-value">
                {report.competitorLandscape.totalTrials}
              </div>
              <div className="score-label">Total Trials</div>
            </div>
            <div className="score-item">
              <div className="score-value" style={{ color: "#3b82f6" }}>
                {report.competitorLandscape.activeTrials}
              </div>
              <div className="score-label">Active</div>
            </div>
            <div className="score-item">
              <div className="score-value" style={{ color: "#22c55e" }}>
                {report.competitorLandscape.completedTrials}
              </div>
              <div className="score-label">Completed</div>
            </div>
            <div className="score-item">
              <div className="score-value" style={{ color: "#ef4444" }}>
                {report.competitorLandscape.failedTrials}
              </div>
              <div className="score-label">Failed</div>
            </div>
          </div>
          {report.competitorLandscape.landscapeSummary && (
            <p style={{ marginTop: "1rem", color: "#64748b" }}>
              {report.competitorLandscape.landscapeSummary}
            </p>
          )}
        </div>
      )}

      {/* Known Drugs */}
      {report.knownDrugs && report.knownDrugs.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>
            Known Drugs ({report.knownDrugs.length})
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Drug</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Phase</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>MoA</th>
              </tr>
            </thead>
            <tbody>
              {report.knownDrugs.slice(0, 10).map((drug, idx) => (
                <tr
                  key={idx}
                  style={{ borderTop: "1px solid #e2e8f0" }}
                >
                  <td style={{ padding: "0.5rem" }}>{drug.drugName}</td>
                  <td style={{ padding: "0.5rem" }}>{drug.phase}</td>
                  <td style={{ padding: "0.5rem" }}>{drug.status}</td>
                  <td
                    style={{
                      padding: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#64748b",
                    }}
                  >
                    {drug.mechanismOfAction?.slice(0, 50)}
                    {drug.mechanismOfAction && drug.mechanismOfAction.length > 50
                      ? "..."
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recommendations */}
      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginBottom: "1rem" }}>Recommendations</h3>
        <ul className="recommendations-list">
          {report.recommendations.map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
