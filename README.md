# Task Desk - Backend

Task Desk is a robust, collaborative, and gamified task management backend system built with Node.js and Express. It powers workspaces (Plans), real-time collaboration via Socket.io, dynamic recurring tasks, and user streaks.

---

## 🚀 Features

- **🔐 Secure Authentication:** JWT-based user authentication, role management, and encrypted storage using `bcrypt`. Includes persistent session verification endpoints.
- **📁 Collaborative Workspaces (Plans):** Create unlimited plans, invite peers via a structured invite system, and track plan-wide completion streaks.
- **📝 Advanced Task Management:** Create instances of tasks spanning date ranges, configure priorities, drag-and-drop rescheduling, and attach proof images.
- **🔄 Dynamic Recurring Tasks:** Supports `daily`, `weekly`, `monthly`, and `custom` interval recurrences that automatically generate the next instance upon completion.
- **⚡ Real-Time WebSockets:** Uses `socket.io` for instantaneous UI updates across plans for task creation, completion, rescheduling, and invites.
- **🎮 Gamification (XP & Streaks):** Awards XP points for task completion and tracks continuous daily activity streaks for both individual users and collaborative plans.
- **📅 Calendar & Search APIs:** Tailored endpoints for fetching tasks bounded by calendar date ranges, and regex-powered paginated global search.
- **🔔 Notification System:** Centralized notification inbox for invites and task updates, complete with pagination and `mark-all-read` functionality.
- **🖼️ Image Uploads:** Direct integration with ImageKit for handling multipart profile and task image attachments.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (using Mongoose ODM)
- **Real-Time:** Socket.io
- **Security:** JSON Web Tokens (JWT), bcrypt
- **File Storage:** ImageKit

---


## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd taskdesk-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   # or
   node server.js
   ```
   *The server will start on port 3000 (or the port defined in your `.env`).*

---

## 📖 API Reference

A fully detailed breakdown of the API endpoints, required payloads, and HTTP status codes is available in the `api_documentation.txt` file located in the root of this project.

### Core Architecture

- **Auth:** `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- **Plans:** `/api/plan/*` (Manage workspaces and members)
- **Invites:** `/api/invite/*` (Send, accept, and reject plan invites) 
- **Tasks:** `/api/task/*` (CRUD, completion logic, search, calendar limits, image uploads)
- **Dashboard:** `/api/dashboard/stats` (Aggregated statistics, XP, and weekly metrics)
- **Notifications:** `/api/notification/*` (Paginated inbox viewing and read receipts)

### WebSocket Events (Socket.io)

Ensure your client passes the JWT token during the handshake protocol:
```javascript
const socket = io("http://localhost:3000", {
  auth: { token: "<your JWT>" }
});
```

**Client Listens for:**
- `invite_received`: Triggers when an invite targets the authenticated user.
- `task_created`, `task_updated`, `task_completed`, `task_rescheduled`: Triggers globally to participants within a joined plan room.
- `member_joined`: Triggers when a new user joins a plan.

**Client Emits:**
- `join_plan(planId)` / `leave_plan(planId)`: Manages room subscriptions.

---

## 🤝 Project Structure

```text
taskdesk-backend/
├── src/
│   ├── config/       # Databases and third-party configuration (ImageKit, DB)
│   ├── controllers/  # Route logic handlers (Auth, Task, Dashboard, etc.)
│   ├── middleware/   # Custom Express middlewares (JWT protection)
│   ├── models/       # Mongoose schemas (User, Task, Plan, TaskInstance, etc.)
│   ├── routes/       # Express route mapping definitions
│   ├── services/     # Reusable logic (ImageKit uploads)
│   ├── app.js        # Express app configuration
│   └── socket.js     # Socket.io initialization and event handling
├── .env              # Environment variables
├── api_documentation.txt  # Comprehensive endpoint spec
└── server.js         # HTTP Server entry point
```

---

## 🛡️ License

This project is licensed under the MIT License.
