import { useState, useEffect } from "react";
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import TriageForm from "./components/TriageForm";
import TriageResults from "./components/TriageResults";
import TriageJobsList from "./components/TriageJobsList";
import SignInForm from "./components/SignInForm";

function App() {
  const { signOut } = useAuthActions();
  const token = useAuthToken();
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth state on mount and when token changes
  useEffect(() => {
    // Give a small delay for the token to be loaded from storage
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Update loading state when token changes
  useEffect(() => {
    if (token !== undefined) {
      setIsLoading(false);
    }
  }, [token]);

  const isAuthenticated = token !== null;

  console.log("Auth state:", { isAuthenticated, isLoading, token: token ? "present" : "null" });

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-content">
            <h1>OpenTargets Agent</h1>
            <p>AI-Powered Drug Target Triage Platform</p>
          </div>
        </header>
        <main className="main">
          <SignInForm />
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>OpenTargets Agent</h1>
          <p>AI-Powered Drug Target Triage Platform</p>
        </div>
        <button className="sign-out-button" onClick={() => signOut()}>
          Sign Out
        </button>
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
