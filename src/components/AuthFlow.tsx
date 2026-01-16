import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface AuthFlowProps {
  children: React.ReactNode;
}

export function AuthFlow({ children }: AuthFlowProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.currentUser);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <SignInSignUp />;
  }

  // Wait for user data
  if (currentUser === undefined) {
    return <LoadingScreen />;
  }

  // Check approval status
  if (!currentUser?.isApproved) {
    return <AccessRequestFlow user={currentUser} />;
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="auth-container">
      <div className="auth-card loading-card">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    </div>
  );
}

function SignInSignUp() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuthActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const signInData: Record<string, string> = {
        email,
        password,
        flow: mode,
      };
      if (mode === "signUp") {
        signInData.name = name;
      }
      await signIn("password", signInData);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1>🎯 OpenTargets Agent</h1>
        <p>AI-Powered Drug Target Triage Platform</p>
        <div className="early-access-badge">
          <span>✨ Early Access</span>
        </div>
      </div>

      <div className="auth-card request-card">
        <h2>{mode === "signIn" ? "Welcome back" : "Create account"}</h2>

        <form onSubmit={handleSubmit} className="access-form">
          {mode === "signUp" && (
            <div className="form-group">
              <label className="form-label" htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
            {loading ? "..." : mode === "signIn" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "signIn" ? (
            <p>
              Don't have an account?{" "}
              <button className="link-button" onClick={() => setMode("signUp")}>
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button className="link-button" onClick={() => setMode("signIn")}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      <div className="auth-footer">
        <p>
          This platform is currently in early access. Sign up to request access
          and we'll review your application.
        </p>
      </div>
    </div>
  );
}

interface User {
  _id: string;
  name?: string;
  email?: string;
  isApproved?: boolean;
  isAdmin?: boolean;
}

function AccessRequestFlow({ user }: { user: User | null }) {
  const [reason, setReason] = useState("");
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState(false);
  const submitRequest = useMutation(api.users.submitAccessRequest);
  const requestStatus = useQuery(api.users.getAccessRequestStatus);
  const { signOut } = useAuthActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitRequest({ reason, organization });
    } finally {
      setLoading(false);
    }
  };

  if (requestStatus?.status === "PENDING") {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <h1>🎯 OpenTargets Agent</h1>
          <p>AI-Powered Drug Target Triage Platform</p>
        </div>

        <div className="auth-card pending-card">
          <div className="pending-icon">⏳</div>
          <h2>Access Request Pending</h2>
          <p>
            Thank you for your interest! Your request is being reviewed.
            We'll notify you at <strong>{user?.email}</strong> once your request is approved.
          </p>
          <div className="request-details">
            <p>
              <strong>Submitted:</strong>{" "}
              {new Date(requestStatus.createdAt).toLocaleDateString()}
            </p>
            {requestStatus.organization && (
              <p>
                <strong>Organization:</strong> {requestStatus.organization}
              </p>
            )}
          </div>
          <button className="btn btn-secondary" onClick={() => signOut()}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (requestStatus?.status === "REJECTED") {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <h1>🎯 OpenTargets Agent</h1>
          <p>AI-Powered Drug Target Triage Platform</p>
        </div>

        <div className="auth-card rejected-card">
          <div className="rejected-icon">❌</div>
          <h2>Access Request Declined</h2>
          <p>
            Unfortunately, your access request was not approved at this time.
          </p>
          {requestStatus.reviewNote && (
            <div className="review-note">
              <strong>Note from reviewer:</strong>
              <p>{requestStatus.reviewNote}</p>
            </div>
          )}
          <p className="resubmit-hint">
            You can submit a new request with additional information.
          </p>
          <form onSubmit={handleSubmit} className="access-form">
            <div className="form-group">
              <label className="form-label">Organization (optional)</label>
              <input
                type="text"
                className="form-input"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Your company or institution"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Why do you want access? (optional)
              </label>
              <textarea
                className="form-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell us about your use case..."
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Resubmit Request"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => signOut()}
              >
                Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // No request yet - show request form
  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1>🎯 OpenTargets Agent</h1>
        <p>AI-Powered Drug Target Triage Platform</p>
        <div className="early-access-badge">
          <span>✨ Early Access</span>
        </div>
      </div>

      <div className="auth-card request-card">
        <h2>Request Early Access</h2>
        <p className="welcome-text">
          Welcome, <strong>{user?.name || user?.email}</strong>! This platform is currently in
          early access. Please submit a request and we'll review it shortly.
        </p>

        <form onSubmit={handleSubmit} className="access-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={user?.email || ""}
              disabled
            />
          </div>
          <div className="form-group">
            <label className="form-label">Organization (optional)</label>
            <input
              type="text"
              className="form-input"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Your company or institution"
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Why do you want access? (optional)
            </label>
            <textarea
              className="form-textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us about your use case, research interests, or how you plan to use the platform..."
              rows={4}
            />
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Request Access"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => signOut()}
            >
              Sign Out
            </button>
          </div>
        </form>
      </div>

      <div className="auth-footer">
        <p>
          We review access requests manually to ensure quality. You'll receive
          an email once your request is approved.
        </p>
      </div>
    </div>
  );
}
