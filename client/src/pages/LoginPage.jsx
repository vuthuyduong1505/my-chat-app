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
      const { token, user } = response.data;
      login(token, user);
      setSuccess("Đăng nhập thành công. Đang chuyển hướng...");
      setTimeout(() => navigate("/"), 600);
    } catch (err) {
      setError(err.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35";

  return (
    <AuthCard title="Chào mừng trở lại" subtitle="Đăng nhập để tiếp tục với D-Chat.">
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          className={inputClass}
          required
        />
        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Mật khẩu"
          className={inputClass}
          required
        />
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="text-xs font-semibold text-secondary hover:text-primary hover:underline">
            Quên mật khẩu?
          </Link>
        </div>

        {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-2xl border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm font-medium text-primary">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-light shadow-md shadow-primary/25 transition hover:bg-primary/90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-primary/60">
        Chưa có tài khoản?{" "}
        <Link to="/register" className="font-semibold text-secondary hover:text-primary hover:underline">
          Đăng ký
        </Link>
      </p>
    </AuthCard>
  );
}

export default LoginPage;
