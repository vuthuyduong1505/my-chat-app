import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import AuthCard from "../components/AuthCard";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setToastMessage("");
    setLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", { email });
      setToastMessage(response.data?.message || "Mã khôi phục đã được gửi");
      setEmail("");
      setTimeout(() => {
        setToastMessage("");
      }, 2200);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể gửi mã khôi phục. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toastMessage && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      )}
      <AuthCard title="Forgot Password" subtitle="Enter your email to receive a recovery code.">
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />

          {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Recovery Code"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Back to{" "}
          <Link to="/login" className="font-medium text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </AuthCard>
    </>
  );
}

export default ForgotPasswordPage;
