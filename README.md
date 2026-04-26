<div align="center">
  <h1>📝 SyncScript</h1>
  <p><strong>A Real-Time Collaborative Document Editor</strong></p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="Express" />
    <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
    <img src="https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101" alt="Socket.io" />
  </p>
</div>

---

## 📖 Overview

**SyncScript** is a robust, real-time collaborative document editor designed to let multiple users view and edit the same document simultaneously, offering a seamless experience akin to Google Docs. Under the hood, it leverages **Operational Transformation (OT)** algorithms and an event-driven architecture to ensure conflict-free syncing across all connected clients.

## ✨ Features

- **Real-Time Collaboration**: Instantaneously sync keystrokes across multiple clients.
- **Operational Transformation (OT)**: Built-in conflict resolution algorithm ensuring consistency regardless of network latency.
- **Room-based Editing**: Users can create or join specific document "rooms" via unique Document IDs.
- **Persistent Storage**: Periodic saving of document states and histories using MongoDB.
- **Clean UI**: Minimalist, distraction-free environment utilizing React and modern CSS/Tailwind.
- **Scalable Architecture**: Decoupled systems incorporating robust structural design patterns.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS (v4)
- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.io (WebSockets)
- **Database**: MongoDB with Mongoose ODM

---

## 📐 Architecture & Design Patterns

The application follows a modular, event-driven architecture utilizing classic Object-Oriented design patterns:

### 1. Observer Pattern
Facilitates real-time state synchronization. A `DocumentSubject` tracks document changes while the individual WebSocket connections (clients) act as Observers that get automatically notified of state updates.

### 2. Strategy Pattern
The Operational Transformation (OT) mathematical logic is encapsulated inside an `OTContext`, utilizing interchangeable transformation strategies (e.g., `InsertStrategy`, `DeleteStrategy`) based on the delta received.

### 3. Singleton Pattern
Utilized for global services like the `DatabaseConnection` and the main `AppServer` to ensure centralized control and prevent redundant instantiations.

### 🔄 Data Flow Overview

1. **Trigger**: User modifies text in the React frontend.
2. **Diffing**: Change is intercepted, diffed, and a delta operation (`insert` or `delete`) is generated.
3. **Transmission**: Emitted to the Node.js server via WebSockets (`Socket.io`).
4. **Resolution**: The server catches up the operation against recent document history using OT.
5. **Persistence**: Updated document state is asynchronously saved to MongoDB.
6. **Broadcasting**: The transformed operation is broadcast to all other connected clients in the room to process and render natively.

---

## 🚀 Getting Started

Follow these steps to run SyncScript on your local machine.

### Prerequisites

Ensure you have the following installed:
- **Node.js** (v18 or higher recommended)
- **MongoDB** (Local instance via MongoDB Compass or Cloud URI via MongoDB Atlas)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd SyncScript
   ```

2. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   ```

### Configuration

Create a `.env` file in the `server` directory and add the following configuration:

```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/syncscript
FRONTEND_URL=http://localhost:5173
```

*(Ensure your MongoDB is running or replace the URI if you are using Atlas)*

---

## 🏃‍♂️ Running the Application

You'll need two terminal sessions to run both the frontend and backend simultaneously.

### 1. Start the Backend Server
```bash
cd server
npm start
# OR node server.js
```

### 2. Start the Frontend App
In a new terminal at the project root (`SyncScript`):
```bash
npm run dev
```

### 3. Start Collaborating!
Navigate to `http://localhost:5173` in multiple browser tabs or devices. Connect them using the same **Document ID** to watch the magic of Operational Transformation in real-time!

---

<div align="center">
  <p>Built with ❤️ for real-time creativity.</p>
</div>
