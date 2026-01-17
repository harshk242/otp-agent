import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("flow", flow);

    console.log("Submitting auth form:", { flow, email: formData.get("email") });

    try {
      const result = await signIn("password", formData);
      console.log("SignIn result:", result);
    } catch (err) {
      console.error("SignIn error:", err);
      setError(
        err instanceof Error
          ? err.message
          : flow === "signIn"
            ? "Invalid email or password"
            : "Could not create account"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{flow === "signIn" ? "Sign In" : "Create Account"}</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
              placeholder="Enter your password"
              minLength={8}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Loading..." : flow === "signIn" ? "Sign In" : "Sign Up"}
          </button>
        </form>
        <div className="auth-switch">
          {flow === "signIn" ? (
            <p>
              Don't have an account?{" "}
              <button type="button" onClick={() => setFlow("signUp")}>
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button type="button" onClick={() => setFlow("signIn")}>
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
