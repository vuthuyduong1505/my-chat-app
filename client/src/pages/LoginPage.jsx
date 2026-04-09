import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import AuthCard from "../components/AuthCard";

function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", formData);
      const { token } = response.data;
      login(token);
      setSuccess("Login successful. Redirecting...");
      setTimeout(() => navigate("/home"), 600);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Welcome Back" subtitle="Login to continue to Chat App.">
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />
          <input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />
          <div className="-mt-2 text-right">
            <Link to="/forgot-password" className="text-xs font-medium text-blue-600 hover:underline">
              Forgot Password?
            </Link>
          </div>

          {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
          {success && (
            <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="font-medium text-blue-600 hover:underline">
          Register
        </Link>
      </p>
    </AuthCard>
  );
}

export default LoginPage;
