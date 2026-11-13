import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "../lib/firebaseClient.js";
import { useAuth } from "../components/AuthProvider.js";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { error, setError } = useAuth();
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(getClientAuth(), email, password);
    } catch {
      setError(
        "Could not sign in. Check your credentials and Firebase configuration.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="eyebrow">CELLXPRESS / REPAIR OPERATIONS</div>
        <h1>
          Less paperwork.
          <br />
          More repairs.
        </h1>
        <p>One workspace from the first voice note to the final collection.</p>
        <div className="login-stamp">Intake → Repair → Collection</div>
      </section>
      <section className="login-panel">
        <div className="eyebrow">STAFF ACCESS</div>
        <h2>Welcome back.</h2>
        <p className="muted">Sign in to your repair workspace.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Staff email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="status-line error" role="alert">
              {error}
            </p>
          )}
          <button className="btn wide" disabled={busy}>
            {busy ? "Signing in…" : "Sign in →"}
          </button>
        </form>
        <p className="login-note">
          Access is provisioned by your administrator. There is no public
          registration.
        </p>
      </section>
    </main>
  );
}
