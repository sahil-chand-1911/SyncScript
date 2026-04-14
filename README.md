# SyncScript 📝 - Project Title and Overview

**SyncScript** is a real-time collaborative document editor that allows multiple users to view and edit the same document simultaneously, similar to Google Docs. It handles real-time synchronization out-of-the-box and features robust conflict resolution utilizing **Operational Transformation (OT)**.

---

## Tech Stack

Here are the languages, frameworks, databases, and tools used in this project:

- **Languages:** JavaScript, TypeScript, HTML5, CSS3
- **Frontend Framework:** React (bootstrapped with Vite)
- **Backend Framework:** Node.js, Express.js
- **Database:** MongoDB (using Mongoose ODM)
- **Real-time Tools:** Socket.io (for WebSocket communication)

---

## Architecture Explanation

The application follows a modular and event-driven architecture utilizing classic design patterns to ensure scalability, real-time sync, and maintainability. 

### Core Design Patterns Utilized:
1. **Observer Pattern:** Facilitates real-time synchronization. `DocumentSubject` tracks document state and history, while individual WebSocket connections (clients) act as Observers.
2. **Strategy Pattern:** Operational Transformation (OT) math logic is encapsulated inside `OTContext` utilizing different Transformation Strategies (`InsertStrategy` vs `DeleteStrategy`).
3. **Singleton Pattern:** Used for MongoDB database connections and Server Initialization to ensure a single centralized point of control.

### Data Flow Overview:
1. **Trigger:** A user types a character in the React frontend.
2. **Diffing:** Changes are diffed, and an operation (`insert` or `delete`) is generated.
3. **Transmission:** The operation is emitted to the Node.js server via WebSockets (`Socket.io`).
4. **Resolution:** The server receives the operation and runs it through `OTContext.catchUp` to resolve any conflicts against recent document history (OT logic).
5. **Persistence:** The processed operation is applied to the MongoDB database.
6. **Broadcasting:** The Server notifies all other connected clients about the transformation.
7. **Client Application:** Connected clients apply the transformed operation to seamlessly update their screens without interrupting their own typing.

---

## Setup and Installation Instructions

### Prerequisites
Before you start, ensure you have the following installed:
- Node.js (v18 or higher recommended)
- MongoDB (Running locally via MongoDB Compass, or a MongoDB Atlas cloud cluster URI)

### Installation Steps

1. **Clone the repository** to your local machine:
   ```bash
   git clone <your-repository-url>
   cd SyncScript
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Install backend dependencies**:
   ```bash
   cd server
   npm install
   ```

4. **Environment Configuration**:
   - Create a `.env` file in the `server` directory containing your MongoDB Connection string and desired port:
     ```env
     PORT=5000
     MONGODB_URI=mongodb://localhost:27017/syncscript
     ```

---

## How to Run the Project

You will need to run the application using two separate terminal instances—one for the backend and one for the frontend.

**1. Start the Backend Server**
Open a terminal, navigate to the `server` directory, and start the backend:
```bash
cd server
npm start
# OR node server.js
```

**2. Start the Frontend Application**
Open a new terminal window, navigate to the root directory `SyncScript`, and start the Vite development server:
```bash
npm run dev
```

**3. Test the Setup**
- Open your browser and navigate to `http://localhost:5173` (or the local link provided by Vite).
- Open the application in multiple tabs or browsers using the **same document ID/URL** to test the collaborative real-time editing features!
