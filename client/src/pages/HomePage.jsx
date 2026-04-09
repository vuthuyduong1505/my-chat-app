import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function HomePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-slate-800">Home</h1>
        <p className="mt-3 text-slate-600">
          Login successful. You can now continue building your chat experience.
        </p>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 rounded-lg bg-slate-800 px-5 py-2.5 font-medium text-white transition hover:bg-slate-900"
        >
          Logout
        </button>
      </div>
    </main>
  );
}

export default HomePage;
