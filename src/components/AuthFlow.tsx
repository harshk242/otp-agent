import { useState, useEffect } from "react";
import {
  SignIn,
  SignUp,
  useUser,
  useAuth,
  UserButton,
} from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface AuthFlowProps {
  children: React.ReactNode;
}

export function AuthFlow({ children }: AuthFlowProps) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const [authView, setAuthView] = useState<"signin" | "signup">("signin");

  const storeUser = useMutation(api.auth.storeUser);

  // Get current user from our database
  const currentUser = useQuery(
    api.auth.getCurrentUser,
    clerkUser?.id ? { tokenIdentifier: `clerk|${clerkUser.id}` } : "skip"
  );

  // Store user in our database when they sign in
  useEffect(() => {
    if (isSignedIn && clerkUser && currentUser === null) {
      storeUser({
        tokenIdentifier: `clerk|${clerkUser.id}`,
        name:
          clerkUser.fullName ||
          clerkUser.firstName ||
          clerkUser.emailAddresses[0]?.emailAddress ||
          "User",
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        imageUrl: clerkUser.imageUrl,
      });
    }
  }, [isSignedIn, clerkUser, currentUser, storeUser]);

  // Show loading while auth is initializing
  if (!authLoaded || !userLoaded) {
    return <LoadingScreen message="Initializing..." />;
  }

  // Not signed in - show auth screen
  if (!isSignedIn) {
    return (
      <AuthScreen authView={authView} onViewChange={setAuthView} />
    );
  }

  // Signed in but waiting for user data
  if (currentUser === undefined) {
    return <LoadingScreen message="Loading your profile..." />;
  }

  // User just signed up - need to create in our DB
  if (currentUser === null) {
    return <LoadingScreen message="Setting up your account..." />;
  }

  // User exists but not approved - show access request flow
  if (!currentUser.isApproved) {
    return <AccessRequestFlow user={currentUser} />;
  }

  // User is approved - show the app
  return <>{children}</>;
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="auth-container">
      <div className="auth-card loading-card">
        <div className="spinner"></div>
        <p>{message}</p>
      </div>
    </div>
  );
}

interface AuthScreenProps {
  authView: "signin" | "signup";
  onViewChange: (view: "signin" | "signup") => void;
}

function AuthScreen({ authView, onViewChange }: AuthScreenProps) {
  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1>🎯 OpenTargets Agent</h1>
        <p>AI-Powered Drug Target Triage Platform</p>
        <div className="early-access-badge">
          <span>✨ Early Access</span>
        </div>
      </div>

      <div className="auth-card">
        {authView === "signin" ? (
          <>
            <SignIn
              appearance={{
                elements: {
                  rootBox: "clerk-root",
                  card: "clerk-card",
                  headerTitle: "clerk-title",
                  headerSubtitle: "clerk-subtitle",
                  formButtonPrimary: "clerk-btn-primary",
                  formFieldInput: "clerk-input",
                  footerActionLink: "clerk-link",
                },
              }}
              routing="hash"
            />
            <div className="auth-switch">
              <p>
                Don't have an account?{" "}
                <button
                  className="link-button"
                  onClick={() => onViewChange("signup")}
                >
                  Request Access
                </button>
              </p>
            </div>
          </>
        ) : (
          <>
            <SignUp
              appearance={{
                elements: {
                  rootBox: "clerk-root",
                  card: "clerk-card",
                  headerTitle: "clerk-title",
                  headerSubtitle: "clerk-subtitle",
                  formButtonPrimary: "clerk-btn-primary",
                  formFieldInput: "clerk-input",
                  footerActionLink: "clerk-link",
                },
              }}
              routing="hash"
            />
            <div className="auth-switch">
              <p>
                Already have an account?{" "}
                <button
                  className="link-button"
                  onClick={() => onViewChange("signin")}
                >
                  Sign In
                </button>
              </p>
            </div>
          </>
        )}
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
  _id: Id<"users">;
  name: string;
  email: string;
  isApproved: boolean;
  isAdmin: boolean;
}

function AccessRequestFlow({ user }: { user: User }) {
  const [reason, setReason] = useState("");
  const [organization, setOrganization] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signOut } = useAuth();

  const submitRequest = useMutation(api.auth.submitAccessRequest);
  const requestStatus = useQuery(api.auth.getAccessRequestStatus, {
    userId: user._id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await submitRequest({
        userId: user._id,
        reason: reason || undefined,
        organization: organization || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Already has a pending or approved request
  if (requestStatus) {
    if (requestStatus.status === "PENDING") {
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
              Thank you for your interest! Your access request is being
              reviewed. We'll notify you at <strong>{user.email}</strong> once
              your request is approved.
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

    if (requestStatus.status === "REJECTED") {
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
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Resubmit Request"}
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
          Welcome, <strong>{user.name}</strong>! This platform is currently in
          early access. Please submit a request and we'll review it shortly.
        </p>

        <form onSubmit={handleSubmit} className="access-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={user.email}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Request Access"}
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

// Header component with user button for approved users
export function AuthHeader() {
  const { user } = useUser();
  const currentUser = useQuery(
    api.auth.getCurrentUser,
    user?.id ? { tokenIdentifier: `clerk|${user.id}` } : "skip"
  );

  return (
    <div className="auth-header-bar">
      <div className="user-info">
        {currentUser?.isAdmin && (
          <span className="admin-badge">Admin</span>
        )}
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
}
