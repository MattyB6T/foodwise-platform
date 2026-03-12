import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    try {
      await login(email.trim(), password);
    } catch {
      // Error handled in context
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none">
                <rect x="3" y="7" width="26" height="3.5" rx="1.2" fill="white" />
                <rect x="5.5" y="10.5" width="3" height="13" rx="0.8" fill="white" opacity="0.8" />
                <rect x="23.5" y="10.5" width="3" height="13" rx="0.8" fill="white" opacity="0.8" />
                <path d="M11 14h2v6.5h3v2h-5V14z" fill="white" />
                <path d="M17 14h6v2h-2v6.5h-2V16h-2v-2z" fill="white" />
              </svg>
            </div>
            <span className="text-3xl font-black tracking-tight text-white">
              Lean<span className="text-blue-400">Table</span>
            </span>
          </div>
          <p className="text-slate-400 text-sm">Smarter Restaurant Operations</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-xl">
          <h2 className="text-lg font-bold text-white text-center mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/25"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
