import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api";
import AuthCard from "../components/AuthCard";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", { email });
      toast.success(response.data?.message || "Mã khôi phục đã được gửi");
      setEmail("");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể gửi mã khôi phục. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35";

  return (
    <>
      <AuthCard title="Quên mật khẩu" subtitle="Nhập email để nhận mã khôi phục.">
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className={inputClass}
            required
          />

          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-light shadow-md shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang gửi..." : "Gửi mã khôi phục"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-primary/60">
          Quay lại{" "}
          <Link to="/login" className="font-semibold text-secondary hover:text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </AuthCard>
    </>
  );
}

export default ForgotPasswordPage;
