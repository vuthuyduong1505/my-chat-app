import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import AuthCard from "../components/AuthCard";

function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register", formData);
      setSuccess("Đăng ký thành công. Đang chuyển đến đăng nhập...");
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      setError(err.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35";

  return (
    <AuthCard title="Tạo tài khoản" subtitle="Tham gia D-Chat chỉ trong vài bước.">
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            name="firstName"
            type="text"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="Tên"
            className={inputClass}
            required
          />
          <input
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Họ"
            className={inputClass}
            required
          />
        </div>
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
          placeholder="Mật khẩu (tối thiểu 6 ký tự)"
          className={inputClass}
          minLength={6}
          required
        />
        <input
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Xác nhận mật khẩu"
          className={inputClass}
          minLength={6}
          required
        />

        {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-2xl border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm font-medium text-primary">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-secondary py-3.5 text-sm font-semibold text-primary shadow-md shadow-secondary/25 transition hover:brightness-95 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-primary/60">
        Đã có tài khoản?{" "}
        <Link to="/login" className="font-semibold text-secondary hover:text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthCard>
  );
}

export default RegisterPage;
