import axios from "axios";
//Tạo API client với base URL là http://localhost:5000/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api"
});
//Interceptor request để thêm token vào header Authorization
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
//Interceptor response để xử lý lỗi 401 và redirect về trang login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";
    const isAuthScreenRequest =
      requestUrl.includes("/auth/login") || 
      requestUrl.includes("/auth/register") ||  
      requestUrl.includes("/auth/forgot-password");

    if (status === 401 && !isAuthScreenRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("auth_user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
