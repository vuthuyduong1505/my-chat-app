# Chat App (Login/Register)

Project includes:

- `server`: Node.js + Express + MongoDB + JWT auth APIs
- `client`: React (Vite) + Tailwind CSS + axios + react-router-dom

## Project Structure (Refactored)

### Server

- `server.js`: bootstrap app, connect MongoDB, register routes
- `models/`: MongoDB schemas (`User`, `Message`)
- `routes/`: API endpoints with inline business logic (`auth`, `chat`)
- `middleware/`: reusable middleware (`authMiddleware`)

### Client (`src/`)

- `pages/`: `LoginPage`, `RegisterPage`, `HomePage`
- `components/`: shared UI pieces (e.g. `AuthCard`)
- `context/`: authentication state (`AuthContext`)
- `api.js`: centralized axios instance

## 1) Setup Backend (Server)

Open terminal 1:

```bash
cd server
npm install
```

Create/edit file `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://vuthuyduong1505:Duong%40%4015052005@cluster0.8bvkv6a.mongodb.net/chat_app?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=change_this_to_a_strong_secret_key
```

Run backend:

```bash
npm run dev
```

Backend URL: `http://localhost:5000`

Available auth APIs:

- `POST /api/auth/register`
- `POST /api/auth/login`

## 2) Setup Frontend (Client)

Open terminal 2:

```bash
cd client
npm install
```

Optional API base config in `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Run frontend:

```bash
npm run dev
```

Frontend URL: `http://localhost:5173`

## 3) Auth Flow

- Register account at `/register`
- Login at `/login`
- On successful login, JWT token is saved to `localStorage`
- User is redirected to `/home`
