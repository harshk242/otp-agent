import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

interface TriageFormProps {
  onTriageComplete: (jobId: string) => void;
}

interface DiseaseOption {
  id: string;
  name: string;
  description: string;
}

// Preset gene lists for common diseases
const PRESETS = {
  NASH: {
    diseaseId: "EFO_0001422",
    diseaseName: "Non-alcoholic fatty liver disease",
    genes: [
      "PNPLA3",
      "TM6SF2",
      "HSD17B13",
      "MBOAT7",
      "GCKR",
      "MARC1",
      "FASN",
      "ACC1",
      "SCD1",
      "DGAT2",
      "CCR2",
      "CCR5",
      "LOXL2",
      "THRB",
      "NR1H4",
      "FGFR4",
    ],
  },
  Alzheimers: {
    diseaseId: "EFO_0006514",
    diseaseName: "Alzheimer's disease",
    genes: ["APP", "PSEN1", "PSEN2", "APOE", "TREM2", "CLU", "BIN1", "CD33"],
  },
  BreastCancer: {
    diseaseId: "EFO_0000305",
    diseaseName: "Breast cancer",
    genes: ["BRCA1", "BRCA2", "TP53", "ERBB2", "ESR1", "PIK3CA", "CDK4", "CDK6"],
  },
};

export default function TriageForm({ onTriageComplete }: TriageFormProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [diseaseOptions, setDiseaseOptions] = useState<DiseaseOption[]>([]);
  const [selectedDisease, setSelectedDisease] = useState<DiseaseOption | null>(null);
  const [manualDiseaseId, setManualDiseaseId] = useState("");
  const [manualDiseaseName, setManualDiseaseName] = useState("");
  const [genesText, setGenesText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runTriage = useAction(api.agent.runTriage);
  const searchDiseases = useAction(api.agent.searchDiseases);

  const handlePresetSelect = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    setSelectedDisease({
      id: preset.diseaseId,
      name: preset.diseaseName,
      description: "",
    });
    setGenesText(preset.genes.join("\n"));
    setDiseaseOptions([]);
    setSearchQuery("");
  };

  const handleDiseaseSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setDiseaseOptions([]);
    setSelectedDisease(null);

    try {
      const results = await searchDiseases({ query: searchQuery });
      if (results && results.length > 0) {
        setDiseaseOptions(results);
      } else {
        setError("No diseases found. Please try a different search term.");
      }
    } catch (err) {
      setError("Error searching for diseases.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleDiseaseSelect = (disease: DiseaseOption) => {
    setSelectedDisease(disease);
    setDiseaseOptions([]);
  };

  const handleResetDisease = () => {
    setSelectedDisease(null);
    setSearchQuery("");
    setDiseaseOptions([]);
    setManualDiseaseId("");
    setManualDiseaseName("");
  };

  const handleManualDiseaseSubmit = () => {
    if (!manualDiseaseId.trim()) {
      setError("Please enter a disease ID.");
      return;
    }
    setError(null);
    setSelectedDisease({
      id: manualDiseaseId.trim(),
      name: manualDiseaseName.trim() || manualDiseaseId.trim(),
      description: "",
    });
    setDiseaseOptions([]);
    setSearchQuery("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDisease || !genesText.trim()) {
      setError("Please select a disease and enter target genes.");
      return;
    }

    const genes = genesText
      .split(/[\n,]/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0)
      .map((symbol) => ({ symbol }));

    if (genes.length === 0) {
      setError("Please enter at least one gene.");
      return;
    }

    setIsRunning(true);
    setProgress(0);

    try {
      const result = await runTriage({
        genes,
        diseaseId: selectedDisease.id,
        diseaseName: selectedDisease.name,
      });

      onTriageComplete(result.jobId);
    } catch (err) {
      setError(`Triage failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "1.5rem" }}>Start New Target Triage</h2>

      {/* Preset buttons */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label className="form-label">Quick Start Presets</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handlePresetSelect("NASH")}
          >
            NASH/MAFLD
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handlePresetSelect("Alzheimers")}
          >
            Alzheimer's
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handlePresetSelect("BreastCancer")}
          >
            Breast Cancer
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Disease Selection - Only show if no disease selected */}
        {!selectedDisease && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label className="form-label">Step 1: Select Disease</label>
            
            {/* Two options in a grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.5rem",
                marginTop: "0.5rem",
              }}
            >
              {/* Option 1: Search by name */}
              <div
                style={{
                  padding: "1rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: "0.75rem",
                    color: "#334155",
                  }}
                >
                  Option A: Search by Disease Name
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Alzheimer's disease"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleDiseaseSearch();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleDiseaseSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? "..." : "Search"}
                  </button>
                </div>
              </div>

              {/* Option 2: Enter ID manually */}
              <div
                style={{
                  padding: "1rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: "0.75rem",
                    color: "#334155",
                  }}
                >
                  Option B: Enter Disease ID Manually
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Disease ID (e.g., EFO_0000249)"
                    value={manualDiseaseId}
                    onChange={(e) => setManualDiseaseId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleManualDiseaseSubmit();
                      }
                    }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Disease Name (optional, for display)"
                    value={manualDiseaseName}
                    onChange={(e) => setManualDiseaseName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleManualDiseaseSubmit();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleManualDiseaseSubmit}
                    style={{ alignSelf: "flex-start" }}
                  >
                    Use This ID
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Disease Display */}
        {selectedDisease && (
          <div
            className="card"
            style={{
              marginBottom: "1.5rem",
              padding: "1rem",
              background: "#dcfce7",
              border: "2px solid #22c55e",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                  ✅ Selected Disease
                </div>
                <div style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                  {selectedDisease.name}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#16a34a", marginBottom: "0.25rem" }}>
                  <strong>ID:</strong> {selectedDisease.id}
                </div>
                {selectedDisease.description && (
                  <div style={{ fontSize: "0.875rem", color: "#15803d" }}>
                    {selectedDisease.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetDisease}
                style={{ marginLeft: "1rem" }}
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Disease Options List */}
        {diseaseOptions.length > 0 && !selectedDisease && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: "0.5rem",
                color: "#64748b",
              }}
            >
              Select a disease from the results below ({diseaseOptions.length} results):
            </div>
            <div
              style={{
                maxHeight: "400px",
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                overflowX: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                }}
              >
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#f8fafc",
                    zIndex: 1,
                  }}
                >
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.75rem 1rem",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: "#475569",
                        width: "25%",
                      }}
                    >
                      Disease Name
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.75rem 1rem",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: "#475569",
                        width: "15%",
                      }}
                    >
                      Disease ID
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.75rem 1rem",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: "#475569",
                        width: "60%",
                      }}
                    >
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {diseaseOptions.map((disease) => (
                    <tr
                      key={disease.id}
                      onClick={() => handleDiseaseSelect(disease)}
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px solid #e2e8f0",
                        transition: "background-color 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#f1f5f9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontWeight: 600,
                          fontSize: "0.9375rem",
                          verticalAlign: "top",
                          wordWrap: "break-word",
                        }}
                      >
                        {disease.name}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontSize: "0.8125rem",
                          color: "#3b82f6",
                          fontFamily: "monospace",
                          verticalAlign: "top",
                          wordWrap: "break-word",
                        }}
                      >
                        {disease.id}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontSize: "0.875rem",
                          color: "#64748b",
                          verticalAlign: "top",
                          lineHeight: "1.5",
                          wordWrap: "break-word",
                        }}
                      >
                        {disease.description || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Genes input - only show when disease is selected */}
        {selectedDisease && (
          <div className="form-group">
            <label className="form-label">Step 2: Enter Target Genes</label>
            <textarea
              className="form-textarea"
              placeholder="Enter gene symbols, one per line or comma-separated:&#10;PNPLA3&#10;TM6SF2&#10;HSD17B13"
              value={genesText}
              onChange={(e) => setGenesText(e.target.value)}
            />
            <p className="form-hint">
              {genesText
                .split(/[\n,]/)
                .map((g) => g.trim())
                .filter((g) => g.length > 0).length}{" "}
              genes entered
            </p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div
            style={{
              padding: "1rem",
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Progress display */}
        {isRunning && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-text">
              <span>Processing...</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        {/* Submit button - only show when disease is selected */}
        {selectedDisease && (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isRunning}
            style={{ width: "100%" }}
          >
            {isRunning ? (
              <>
                <span className="spinner" style={{ width: "20px", height: "20px" }} />
                Running Triage...
              </>
            ) : (
              "Run Triage Analysis"
            )}
          </button>
        )}
      </form>
    </div>
  );
}
