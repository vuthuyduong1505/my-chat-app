import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api";
import AuthCard from "../components/AuthCard";

function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Link đặt lại mật khẩu không hợp lệ.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu không khớp.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password", { token, newPassword });
      toast.success(response.data?.message || "Đặt lại mật khẩu thành công.");
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Không thể đặt lại mật khẩu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35";

  return (
    <AuthCard title="Đặt lại mật khẩu" subtitle="Nhập mật khẩu mới cho tài khoản của bạn.">
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Mật khẩu mới"
          className={inputClass}
          required
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Xác nhận mật khẩu mới"
          className={inputClass}
          required
        />

        {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-light shadow-md shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-primary/60">
        Quay lại{" "}
        <Link to="/login" className="font-semibold text-secondary hover:text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthCard>
  );
}

export default ResetPasswordPage;
