import { useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Lock, Mail, User } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstName(user?.firstName || "");
    setLastName(user?.lastName || "");
    setEmail(user?.email || "");
    setAvatarUrl(user?.avatar || "");
    setAvatarLoadError(false);
  }, [user]);

  const fallbackInitial = useMemo(() => {
    const fullName = `${firstName} ${lastName}`.trim();
    const base = fullName || email || "U";
    return base.charAt(0).toUpperCase();
  }, [firstName, lastName, email]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Vui lòng nhập đầy đủ họ và tên.");
      return;
    }

    if (
      (oldPassword && (!newPassword || !confirmNewPassword)) ||
      (!oldPassword && (newPassword || confirmNewPassword))
    ) {
      toast.error("Vui lòng nhập đầy đủ mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu mới.");
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      toast.error("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    setSaving(true);
    try {
      const profileResponse = await api.put("/users/profile", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatar: avatarUrl.trim()
      });

      const nextUser = profileResponse.data?.user;
      if (nextUser) {
        updateUser(nextUser);
      }

      if (oldPassword && newPassword && confirmNewPassword) {
        await api.put("/users/change-password", { oldPassword, newPassword });
        setOldPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        toast.success("Đã cập nhật hồ sơ và đổi mật khẩu thành công.");
      } else {
        toast.success("Đã cập nhật hồ sơ thành công.");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Không thể lưu thay đổi. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
   
   <div className="h-full min-h-0 overflow-y-auto bg-accent/40 px-3 py-4 sm:px-4 md:px-6">
      <form onSubmit={handleSave} className="mx-auto w-full max-w-5xl space-y-4">
        <section className="rounded-3xl border border-primary/10 bg-light p-4 shadow-soft sm:p-5">
          <h1 className="text-xl font-bold text-primary md:text-2xl">Hồ sơ cá nhân</h1>
          <p className="mt-1 text-sm text-primary/60">Quản lý thông tin cá nhân và bảo mật tài khoản của bạn.</p>
        </section>
        
        <section className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <div className="rounded-3xl border border-primary/10 bg-light p-4 shadow-soft sm:p-5">
            <p className="mb-4 text-sm font-semibold text-primary">Ảnh đại diện</p>
            <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-secondary/40 bg-primary/10 text-primary">
              {avatarUrl && !avatarLoadError ? (
                <img
                  src={avatarUrl}
                  alt="Ảnh đại diện"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <span className="text-4xl font-bold">{fallbackInitial}</span>
              )}
            </div>
            <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary/75">
              <Camera size={16} className="text-secondary" />
              Link ảnh đại diện
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(event) => {
                setAvatarUrl(event.target.value);
                setAvatarLoadError(false);
              }}
              placeholder="https://example.com/avatar.jpg"
              className="w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35"
            />
          </div>

            <div className="space-y-4">
            <div className="rounded-3xl border border-primary/10 bg-light p-4 shadow-soft sm:p-5">
              <p className="mb-4 text-sm font-semibold text-primary">Thông tin tài khoản</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary/75">
                    <User size={16} className="text-secondary" />
                    Họ
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35"
                    placeholder="Nhập họ"
                  />
                </div>
                <div>
                  <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary/75">
                    <User size={16} className="text-secondary" />
                    Tên
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35"
                    placeholder="Nhập tên"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary/75">
                  <Mail size={16} className="text-secondary" />
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full cursor-not-allowed rounded-2xl border border-primary/10 bg-accent/80 px-4 py-3 text-sm text-primary/70 outline-none"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-primary/10 bg-light p-4 shadow-soft sm:p-5">
              <h2 className="mb-4 text-sm font-semibold text-primary">Bảo mật</h2>
              <div className="grid gap-3 lg:grid-cols-3">
                <div>
                  <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary/75">
                    <Lock size={16} className="text-secondary" />
                    Mật khẩu cũ
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                    placeholder="Nhập mật khẩu cũ"
                    className="w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35"
                  />
                </div>
                <div>
                  <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary/75">
                    <Lock size={16} className="text-secondary" />
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    className="w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35"
                  />
                </div>
                <div>
                  <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary/75">
                    <Lock size={16} className="text-secondary" />
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full rounded-2xl border border-primary/15 bg-light px-4 py-3 text-sm text-primary outline-none transition placeholder:text-primary/35 focus:border-secondary focus:ring-2 focus:ring-secondary/35"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end pb-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-light shadow-md shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProfilePage;
