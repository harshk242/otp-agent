import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

interface TriageFormProps {
  onTriageComplete: (jobId: string) => void;
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
    diseaseId: "EFO_0000249",
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
  const [diseaseId, setDiseaseId] = useState("");
  const [diseaseName, setDiseaseName] = useState("");
  const [genesText, setGenesText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentGene, setCurrentGene] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runTriage = useAction(api.agent.runTriage);
  const searchDisease = useAction(api.agent.searchDisease);

  const handlePresetSelect = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    setDiseaseId(preset.diseaseId);
    setDiseaseName(preset.diseaseName);
    setGenesText(preset.genes.join("\n"));
  };

  const handleDiseaseSearch = async () => {
    if (!diseaseName.trim()) return;

    try {
      const result = await searchDisease({ query: diseaseName });
      if (result) {
        setDiseaseId(result.id);
        setDiseaseName(result.name);
      } else {
        setError("Disease not found. Please check the name.");
      }
    } catch (err) {
      setError("Error searching for disease.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!diseaseId || !diseaseName || !genesText.trim()) {
      setError("Please fill in all fields.");
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
        diseaseId,
        diseaseName,
      });

      onTriageComplete(result.jobId);
    } catch (err) {
      setError(`Triage failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: "800px", margin: "0 auto" }}>
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
        {/* Disease input */}
        <div className="form-group">
          <label className="form-label">Disease</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              className="form-input"
              placeholder="Enter disease name (e.g., Alzheimer's disease)"
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDiseaseSearch}
            >
              Search
            </button>
          </div>
          {diseaseId && (
            <p className="form-hint">Disease ID: {diseaseId}</p>
          )}
        </div>

        {/* Genes input */}
        <div className="form-group">
          <label className="form-label">Target Genes</label>
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
              <span>Processing: {currentGene || "Starting..."}</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        {/* Submit button */}
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
      </form>
    </div>
  );
}
