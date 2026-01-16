import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import TriageForm from "./components/TriageForm";
import TriageResults from "./components/TriageResults";
import TriageJobsList from "./components/TriageJobsList";

function App() {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🎯 OpenTargets Agent</h1>
          <p>AI-Powered Drug Target Triage Platform</p>
        </div>
      </header>

      <nav className="nav">
        <button
          className={`nav-button ${activeTab === "new" ? "active" : ""}`}
          onClick={() => setActiveTab("new")}
        >
          New Triage
        </button>
        <button
          className={`nav-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </nav>

      <main className="main">
        {activeTab === "new" && (
          <TriageForm
            onTriageComplete={(jobId) => {
              setSelectedJobId(jobId);
              setActiveTab("history");
            }}
          />
        )}

        {activeTab === "history" && (
          <div className="history-container">
            <div className="jobs-panel">
              <h2>Triage Jobs</h2>
              <TriageJobsList
                selectedJobId={selectedJobId}
                onSelectJob={setSelectedJobId}
              />
            </div>
            <div className="results-panel">
              {selectedJobId ? (
                <TriageResults jobId={selectedJobId} />
              ) : (
                <div className="no-selection">
                  <p>Select a triage job to view results</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          Built with Convex + React | Data from Open Targets Platform, ChEMBL,
          PubMed, and ClinicalTrials.gov
        </p>
      </footer>
    </div>
  );
}

export default App;
