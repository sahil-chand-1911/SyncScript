# SyncScript - Real-Time Collaborative Document Editor

A production-grade real-time collaborative document editor built with Node.js, React, Socket.IO, and MongoDB. The system enables multiple users to simultaneously edit shared documents with live synchronization, conflict resolution via Operational Transformation (OT), JWT-based authentication, role-based access control, version history, and active user presence tracking.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Problem Statement](#problem-statement)
3. [Solution Approach](#solution-approach)
4. [Features](#features)
5. [Tech Stack](#tech-stack)
6. [System Architecture](#system-architecture)
7. [OOP Concepts Used](#oop-concepts-used)
8. [Design Patterns Implemented](#design-patterns-implemented)
9. [SOLID Principles](#solid-principles)
10. [Folder Structure](#folder-structure)
11. [Setup and Installation](#setup-and-installation)
12. [How to Run the Project](#how-to-run-the-project)
13. [UML Diagrams](#uml-diagrams)
14. [Team Members and Contributions](#team-members-and-contributions)
15. [Test Cases](#test-cases)
16. [Future Improvements](#future-improvements)

---

## Project Overview

SyncScript is a web-based collaborative document editor that allows multiple authenticated users to create, edit, and manage documents in real time. When one user types, all other connected users see the changes instantly without page reloads.

The system uses Operational Transformation (OT) to resolve editing conflicts that arise when two users modify the same part of a document concurrently. A WebSocket layer (Socket.IO) handles bidirectional communication, while a REST API manages authentication, document metadata, version history, and permission control.

Key highlights:
- Real-time multi-user editing with conflict-free synchronization
- JWT-based authentication with secure WebSocket handshakes
- Role-based permissions (Owner, Editor, Viewer)
- Live presence tracking showing who is currently editing
- User-attributed edit history with operation-level tracking
- Document version snapshots with restore capability
- Clean modular architecture following OOP, SOLID, and classical design patterns

---

## Problem Statement

Building a real-time collaborative editor presents several technical challenges:

1. **Concurrency Conflicts**: When multiple users edit the same position in a document simultaneously, their changes can conflict. Without a resolution mechanism, one user's edits could overwrite another's, leading to data loss.

2. **Network Latency**: Users connected over the internet experience varying levels of latency. The system must handle out-of-order operations and ensure that all clients eventually converge to the same document state (eventual consistency).

3. **State Synchronization**: Every connected client must maintain an identical view of the document. If synchronization fails, users see divergent content, breaking the collaborative experience.

4. **Security and Access Control**: Not all users should have equal access. Some documents are private, some are shared read-only, and the system must enforce these constraints at both the API and WebSocket levels.

5. **Scalability**: As the number of concurrent users and documents grows, the system must remain responsive. Tight coupling between the transport layer and business logic makes horizontal scaling difficult.

---

## Solution Approach

### WebSockets for Real-Time Communication
Socket.IO provides persistent bidirectional connections between clients and the server. Unlike HTTP polling, WebSockets maintain an open channel, enabling sub-second delivery of edits and presence updates.

### Pub/Sub Model for Room-Based Broadcasting
Each document operates as a "room." When a user edits a document, the server broadcasts the change to all other users in that room. An internal EventBus (simulated Redis Pub/Sub) decouples the transport layer from business logic, making the system ready for multi-server deployment.

### Operational Transformation for Conflict Resolution
OT is the algorithm that resolves concurrent edits. When two users insert text at the same position, the OT engine transforms one operation's position to account for the other, ensuring both users see a consistent result. The implementation uses the Strategy Pattern, with separate strategies for insert and delete operations.

### Authentication and Access Control
JWT tokens secure both REST API endpoints and WebSocket connections. A socket authentication middleware validates tokens during the handshake phase, ensuring only authenticated users can join document rooms. Role-based permissions (Owner, Editor, Viewer) are enforced at both the API and socket event levels.

---

## Features

### Authentication
- User registration with email and password
- Login with JWT token generation (7-day expiry)
- Passwords hashed using bcrypt with salt rounds
- Persistent sessions via localStorage

### Document Management
- Create and join documents by unique ID
- Real-time collaborative editing with OT synchronization
- Full document content replacement fallback for complex edits
- Enter key shortcut to quickly join a document room

### Presence System
- Live list of active users per document
- Color-coded user avatars based on name hash
- Real-time join/leave notifications
- "(you)" indicator for the current user

### User-Aware Editing
- Every operation is stamped with userId, userName, and timestamp
- Sidebar feed showing recent edits with user attribution
- Color-coded operation types: green (insert), red (delete), amber (replace)
- Relative timestamps ("just now", "5s ago", "2m ago")

### Version History
- Automatic version snapshots every 10 operations
- Forced snapshots on full content replacements
- Browse past versions with timestamps and author metadata
- Read-only preview of any historical version
- One-click restore to any previous version

### Role-Based Permissions
- Three roles: Owner, Editor, Viewer
- Document creator is automatically assigned as Owner
- Owner can share documents with other users via email
- Owner can set collaborator roles and remove access
- Viewers see a lock banner and have a disabled editor
- Permission enforcement at both REST API and WebSocket levels

### UI Features
- Connection status indicator (Connected / Disconnected / Reconnecting)
- Document statistics bar (word count, character count, version number)
- Role badge display (Owner / Editor / Viewer)
- Glassmorphic dark theme with smooth transitions
- Share modal with collaborator management

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, TypeScript | Component-based UI with type safety |
| **Styling** | Vanilla CSS | Glassmorphic dark theme, no framework overhead |
| **Build Tool** | Vite | Fast HMR development server |
| **Backend** | Node.js, Express | REST API server |
| **Real-Time** | Socket.IO | Bidirectional WebSocket communication |
| **Database** | MongoDB, Mongoose | Document storage, user accounts, version history |
| **Auth** | JWT, bcrypt | Token-based authentication, password hashing |
| **Version Control** | Git, GitHub | Source code management |

---

## System Architecture

```
+------------------+        +------------------+
|   React Client   |        |   React Client   |
|   (Browser 1)    |        |   (Browser 2)    |
+--------+---------+        +--------+---------+
         |                           |
         |  WebSocket (Socket.IO)    |
         +------------+--------------+
                      |
         +------------v--------------+
         |      Socket Manager       |  <-- Thin Transport Layer
         |   (Auth + Event Routing)  |
         +------------+--------------+
                      |
         +------------v--------------+
         | Document State Manager    |  <-- Business Logic Layer
         |  (OT + Persist + Version) |
         +-----+------+------+------+
               |      |      |
     +---------+  +---+---+  +----------+
     |            |       |             |
+----v----+ +-----v-----+ +----v------+ +----v----+
| EventBus| | Document  | | Document  | | OT      |
| Pub/Sub | | Subject   | | Version   | | Context |
| Channel | | Observer  | | Model     | | Strategy|
+---------+ +-----------+ +-----------+ +---------+
                      |
              +-------v--------+
              |    MongoDB     |
              |  (Documents,   |
              |   Users,       |
              |   Versions)    |
              +----------------+
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **React Client** | UI rendering, local OT computation, socket event handling |
| **Socket Manager** | JWT authentication, socket event mapping, response routing |
| **Document State Manager** | OT processing, MongoDB persistence, version snapshots, permission checks |
| **EventBus** | Decoupled event-driven communication (simulated Redis Pub/Sub) |
| **Document Subject** | Observer pattern: manages socket subscriptions and presence |
| **OT Context** | Strategy pattern: transforms concurrent operations |

---

## OOP Concepts Used

### Encapsulation
Each class hides its internal state and exposes behavior through well-defined methods. For example, `DocumentSubject` encapsulates the observers array, active users map, and OT history queue. External code interacts only through `subscribe()`, `unsubscribe()`, and `notify*()` methods.

**Files**: `DocumentSubject.js`, `DatabaseConnection (db.js)`, `OTContext (ot.js)`

### Abstraction
The `TransformStrategy` abstract class defines a contract (`transform()` and `apply()`) without specifying implementation details. Callers interact with the abstraction, not the concrete insert/delete logic.

**Files**: `ot.js` (TransformStrategy base class)

### Inheritance
`InsertStrategy` and `DeleteStrategy` extend the abstract `TransformStrategy` class, inheriting the interface contract and overriding `transform()` and `apply()` with operation-specific logic.

**Files**: `ot.js` (InsertStrategy extends TransformStrategy, DeleteStrategy extends TransformStrategy)

### Polymorphism
`OTContext.getStrategy()` returns different strategy objects based on the operation type. The calling code invokes `strategy.transform()` without knowing whether it is dealing with an insert or delete strategy. The correct behavior is resolved at runtime.

**Files**: `ot.js` (OTContext.transform, OTContext.applyOperation)

---

## Design Patterns Implemented

### Observer Pattern
**Where**: `DocumentSubject.js`

**Why**: Real-time collaboration requires broadcasting changes to all connected users instantly. The Observer pattern decouples the event source (document mutations) from the consumers (client sockets). When a user edits a document, the Subject notifies all subscribed Observers without knowing their identities.

**How**: `DocumentSubject` maintains a list of observer sockets. Methods like `notifyAll()`, `notifyOthers()`, and `notifyDirect()` provide granular control over who receives notifications.

### Strategy Pattern
**Where**: `ot.js`

**Why**: Different operation types (insert, delete) require different transformation logic. Hardcoding these rules in a single function would violate the Open/Closed principle. The Strategy pattern allows adding new operation types (e.g., format, move) by simply creating a new strategy class.

**How**: `OTContext` acts as the context class. It selects the appropriate `TransformStrategy` subclass based on `operation.type` and delegates the transformation.

### Singleton Pattern
**Where**: `db.js`, `EventBus.js`, `DocumentSubject.js` (via DocumentManager)

**Why**: Certain resources must exist as exactly one instance per process. Multiple database connection pools would waste resources. Multiple EventBus instances would fragment event channels.

**How**: The constructor checks for an existing instance and returns it if found. A static `getInstance()` method provides explicit access.

### Factory Pattern
**Where**: `DocumentManager.getSubject()` in `DocumentSubject.js`

**Why**: Document subjects should be lazily created on first access and reused thereafter. The factory centralizes creation logic and acts as an object pool.

### Service Layer Pattern
**Where**: `DocumentStateManager.js`

**Why**: Separating business logic from transport concerns makes the code testable, maintainable, and scalable. The socket layer delegates all document mutations to this service.

### Pub/Sub Pattern
**Where**: `EventBus.js`

**Why**: Decoupling producers (document state changes) from consumers (socket notifications) enables horizontal scaling. In production, the in-memory EventEmitter would be replaced with Redis Pub/Sub for cross-server communication.

---

## SOLID Principles

### Single Responsibility Principle (SRP)
Each class has exactly one reason to change:
- `DatabaseConnection` manages only database connectivity
- `OTContext` handles only operational transformation
- `SocketManager` handles only WebSocket transport
- `DocumentStateManager` handles only document state mutations
- `DocumentController` handles only REST API request/response

### Open/Closed Principle (OCP)
The system is open for extension but closed for modification:
- New OT operation types can be added by creating new `TransformStrategy` subclasses without modifying `OTContext`
- New EventBus channels can be published without modifying existing subscribers
- New roles can be added to the permission system without changing the middleware

### Liskov Substitution Principle (LSP)
Subclasses are interchangeable with their base class:
- `InsertStrategy` and `DeleteStrategy` both implement the `TransformStrategy` interface and can be used wherever a `TransformStrategy` is expected
- `OTContext.getStrategy()` returns any strategy without the caller needing to know the concrete type

### Interface Segregation Principle (ISP)
Classes expose focused interfaces rather than monolithic ones:
- `DocumentSubject` provides `notifyAll()`, `notifyOthers()`, and `notifyDirect()` instead of a single generic notification method
- Callers use only the notification method they need

### Dependency Inversion Principle (DIP)
High-level modules depend on abstractions, not concrete implementations:
- `SocketManager` depends on `DocumentStateManager` (service abstraction), not directly on MongoDB models
- `OTContext` depends on the `TransformStrategy` abstraction, not specific insert/delete implementations
- `DocumentStateManager` publishes events to `EventBus` (abstraction), not directly to socket instances

---

## Folder Structure

```
SyncScript/
|-- index.html                    # Vite entry point
|-- package.json                  # Frontend dependencies
|-- vite.config.ts                # Vite configuration
|-- tsconfig.json                 # TypeScript configuration
|
|-- src/                          # Frontend source code
|   |-- main.tsx                  # React entry point
|   |-- App.tsx                   # Root component (auth routing)
|   |-- App.css                   # Global styles (dark theme)
|   |-- index.css                 # Base CSS reset
|   |
|   |-- pages/
|   |   |-- Auth.tsx              # Login/Register forms
|   |   |-- Editor.tsx            # Main editor with sidebar
|   |
|   |-- utils/
|       |-- otLogic.ts            # Client-side OT computation
|
|-- server/                       # Backend source code
|   |-- server.js                 # Application bootstrap
|   |-- .env                      # Environment variables
|   |-- package.json              # Backend dependencies
|   |
|   |-- config/
|   |   |-- db.js                 # MongoDB connection (Singleton)
|   |
|   |-- models/
|   |   |-- User.js               # User schema (bcrypt hashing)
|   |   |-- Document.js           # Document schema (permissions)
|   |   |-- DocumentVersion.js    # Version snapshots schema
|   |
|   |-- controllers/
|   |   |-- authController.js     # Register, Login, GetMe
|   |   |-- documentController.js # CRUD, Versions, Share
|   |
|   |-- middleware/
|   |   |-- authMiddleware.js     # JWT protect (REST + Socket)
|   |
|   |-- routes/
|   |   |-- authRoutes.js         # /api/auth endpoints
|   |   |-- documentRoutes.js     # /api/documents endpoints
|   |
|   |-- services/
|   |   |-- DocumentSubject.js    # Observer pattern (presence)
|   |   |-- DocumentStateManager.js # Business logic service
|   |   |-- EventBus.js           # Pub/Sub event bus
|   |
|   |-- sockets/
|   |   |-- documentSocket.js     # WebSocket transport layer
|   |
|   |-- utils/
|       |-- ot.js                 # OT engine (Strategy pattern)
```

---

## Setup and Installation

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local instance or MongoDB Atlas)
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/sahil-chand-1911/SyncScript.git
cd SyncScript
```

### Step 2: Install Frontend Dependencies

```bash
npm install
```

### Step 3: Install Backend Dependencies

```bash
cd server
npm install
```

### Step 4: Configure Environment Variables

Create a `.env` file inside the `server/` directory:

```env
MONGODB_URI=mongodb://localhost:27017/syncscript
JWT_SECRET=your_secret_key_here
PORT=5001
FRONTEND_URL=http://localhost:5173
```

### Step 5: Ensure MongoDB is Running

```bash
# If using local MongoDB
mongod
```

---

## How to Run the Project

### Start the Backend Server

```bash
cd server
node server.js
```

The server will start on `http://localhost:5001`.

### Start the Frontend Development Server

Open a new terminal:

```bash
# From the project root directory
npm run dev
```

The frontend will start on `http://localhost:5173`.

### Usage

1. Open `http://localhost:5173` in your browser
2. Register a new account or log in with existing credentials
3. Enter a Document ID and click "Join Room" (or press Enter)
4. Open the same URL in another browser/tab with a different account
5. Both users can now edit the document simultaneously
6. Observe real-time changes, presence tracking, and edit history in the sidebar

---

## UML Diagrams

The following UML diagrams are included in the `/docs` folder to illustrate the system design:

- **Class Diagram**: Shows relationships between all major classes (SocketManager, DocumentSubject, OTContext, DocumentStateManager, EventBus, Models)
- **Sequence Diagram**: Illustrates the flow of a real-time edit from one client through the server to other clients
- **Use Case Diagram**: Maps user interactions (Register, Login, Edit, Share, View History, Restore Version)
- **ER Diagram**: Shows the MongoDB schema relationships between User, Document, DocumentVersion, and Collaborator entities

---

## Team Members and Contributions

| Name | Role | Contributions |
|------|------|--------------|
| [Team Member 1] | Full-Stack Developer | Authentication system, user model, JWT middleware |
| [Team Member 2] | Backend Developer | OT engine, WebSocket layer, document state management |
| [Team Member 3] | Frontend Developer | Editor UI, presence sidebar, version history modal |
| [Team Member 4] | Architecture / DevOps | EventBus, scalability design, documentation |
| [Team Member 5] | Testing / QA | Test cases, bug fixes, code review, deployment support |

---

## Test Cases

### Real-Time Editing
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| Two users type simultaneously | User A types "hello", User B types "world" at the same position | Both words appear in the document without data loss |
| Rapid sequential edits | One user types a full sentence quickly | All characters appear in order on other clients |
| Large paste operation | User pastes a 10,000 character block | Document syncs via full-replace fallback |

### Conflict Resolution
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| Concurrent insert at same position | Two users insert text at position 5 | OT transforms one operation; both edits are preserved |
| Insert during delete | User A deletes text while User B inserts at the same region | Both operations are correctly transformed |
| Version mismatch | Client sends operation based on stale version | Server catches up the operation against history |

### Presence and Access
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| User joins document | A new user connects to a room | Active users list updates for all clients |
| User disconnects | A user closes their tab | User is removed from the presence list |
| Viewer attempts edit | A viewer role user tries to type | Textarea is disabled; server rejects the operation |
| Owner shares document | Owner adds a collaborator by email | Collaborator appears in the share modal list |

### Version History
| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| Auto-snapshot | User types 10+ characters | A version snapshot is saved in MongoDB |
| View old version | User opens version history and selects a past version | Read-only preview shows the historical content |
| Restore version | User clicks restore on a past version | Document content reverts; all clients update |

---

## Future Improvements

### Technical Enhancements
- **CRDT Implementation**: Replace OT with Conflict-free Replicated Data Types for stronger consistency guarantees without a central server
- **Redis Integration**: Replace the in-memory EventBus with Redis Pub/Sub for true multi-server horizontal scaling
- **Socket.IO Redis Adapter**: Enable WebSocket rooms to span multiple server instances behind a load balancer

### Feature Additions
- **Rich Text Editing**: Integrate a library like TipTap or ProseMirror for formatting (bold, italic, headings)
- **Cursor Presence**: Show other users' cursor positions in real time
- **Document Dashboard**: A home page listing all documents the user owns or has access to
- **Export Options**: Download documents as PDF, Markdown, or plain text

### Performance Optimization
- **Operation Batching**: Bundle rapid keystrokes into fewer WebSocket messages
- **History Pruning**: Automatically trim the in-memory OT history queue after a threshold
- **Database Indexing**: Add compound indexes for frequently queried fields
- **Connection Pooling**: Optimize MongoDB connection handling for high concurrency

### Deployment
- **Docker Containerization**: Create Docker Compose setup for one-command deployment
- **CI/CD Pipeline**: Automated testing and deployment via GitHub Actions
- **Cloud Hosting**: Deploy to AWS, GCP, or Azure with managed MongoDB (Atlas)

---

## License

This project is developed for academic purposes as part of a coursework project.

---

*Built with care by the SyncScript team.*
