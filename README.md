# SuperMarket — Advanced MERN Supermarket Management & E-Commerce Platform

A production-ready supermarket platform combining online customer shopping, physical-store POS cashier billing, real-time inventory tracking, and role-based administration.

---

## 🌟 Core Features

- **🛍️ Online Grocery E-Commerce**:
  - Full product browsing with category filtering, search, and detail views.
  - Cart and checkout system with stock reservation to prevent overselling.
- **💻 Physical-Store POS Billing**:
  - Cashier barcode-scanner friendly interface with fast keyboard navigation.
  - Quick product search, instant bill calculation, split payments, and receipt generation.
- **📦 Centralized Inventory Control**:
  - Unified stock pool for both online orders and in-store sales.
  - Low-stock alerts, restock workflows, and automated movement auditing.
- **🔐 Multi-Role Access Control (RBAC)**:
  - Role-specific access for **Customer**, **Cashier**, **Inventory Manager**, and **Admin**.
  - Secure JWT authentication with HTTP-only cookies and Supabase integration.
- **⚡ Real-Time Sync**:
  - Socket.io integration for instant inventory updates across online carts and POS terminals.

---

## 🛠️ Tech Stack

### Frontend (`/client`)
- **React 19** with **Vite**
- **Tailwind CSS v3** & **Lucide React** icons
- **React Router v7** (Role-guarded routes)
- **Zustand** (Global state management)
- **React Hook Form** + **Zod** (Schema validation)
- **Socket.io Client** & **@supabase/supabase-js**

### Backend (`/server`)
- **Node.js** & **Express**
- **Supabase PostgreSQL** & **@supabase/supabase-js**
- **@supabase/server**
- **Socket.io** (Real-time events)
- **Winston** (Structured logging) & **Helmet** / **Rate-Limiting** / **CORS** security

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- Supabase Project (PostgreSQL)

### 1. Clone Repository
```bash
git clone https://github.com/rajanv-dev/SuperMarket.git
cd SuperMarket
```

### 2. Backend Setup
```bash
cd server
npm install
cp .env.example .env
# Edit .env and supply your SUPABASE_URL, SUPABASE_SECRET_KEY / SUPABASE_PUBLISHABLE_KEY, and JWT_SECRET
npm run dev
```

### 3. Frontend Setup
```bash
cd ../client
npm install
cp .env.example .env
npm run dev
```

The frontend will run at `http://localhost:5173` and the backend API at `http://localhost:5000`.

---

## 🌐 Render Deployment

### Backend Web Service Environment Variables
When deploying the Express backend (`server/`) to **Render**, set the following environment variables in the Render Dashboard (under **Environment**):

| Variable Name | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | Node environment | `production` |
| `PORT` | Yes (Render sets default) | Port number | `5000` or `10000` |
| `SUPABASE_URL` | Yes | Supabase Project URL | `https://dpdfgequagdyiktlresv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` | Yes | Supabase secret key for server DB operations | `sb_secret_...` or service role key |
| `SUPABASE_PUBLISHABLE_KEY` | Optional | Supabase public key fallback | `sb_publishable_...` |
| `JWT_SECRET` | Yes | Secret key for local JWT validation | 64-character random string |
| `CLIENT_ORIGIN` | Yes | URL of deployed frontend | `https://your-frontend.vercel.app` |

*Note: `MONGO_URI` is no longer required or used.*

---

## 📜 License
MIT
