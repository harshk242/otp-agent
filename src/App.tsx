import { useState } from "react";
import { useQuery } from "convex/react";
import { useUser, UserButton } from "@clerk/clerk-react";
import { api } from "../convex/_generated/api";
import { AuthFlow } from "./components/AuthFlow";
import TriageForm from "./components/TriageForm";
import TriageResults from "./components/TriageResults";
import TriageJobsList from "./components/TriageJobsList";
import AdminDashboard from "./components/AdminDashboard";

function AppContent() {
  const { user: clerkUser } = useUser();
  const [activeTab, setActiveTab] = useState<"new" | "history" | "admin">("new");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const currentUser = useQuery(
    api.auth.getCurrentUser,
    clerkUser?.id ? { tokenIdentifier: `clerk|${clerkUser.id}` } : "skip"
  );

  const isAdmin = currentUser?.isAdmin ?? false;

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🎯 OpenTargets Agent</h1>
          <p>AI-Powered Drug Target Triage Platform</p>
        </div>
        <div className="header-user">
          {isAdmin && <span className="admin-indicator">👑 Admin</span>}
          <UserButton afterSignOutUrl="/" />
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
        {isAdmin && (
          <button
            className={`nav-button admin-nav ${activeTab === "admin" ? "active" : ""}`}
            onClick={() => setActiveTab("admin")}
          >
            👑 Admin
          </button>
        )}
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

        {activeTab === "admin" && isAdmin && <AdminDashboard />}
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

function App() {
  return (
    <AuthFlow>
      <AppContent />
    </AuthFlow>
  );
}

export default App;
