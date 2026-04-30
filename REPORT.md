# SyncScript Project Report

## 1. Problem Statement and Solution Approach

### Problem Statement
Building a real-time collaborative editor presents several technical challenges:
1. **Concurrency Conflicts**: When multiple users edit the same position simultaneously, changes can conflict, leading to data loss.
2. **Network Latency**: The system must handle out-of-order operations and ensure eventual consistency.
3. **State Synchronization**: Every connected client must maintain an identical view of the document.
4. **Security and Access Control**: Strict enforcement of permissions at the API and WebSocket levels.
5. **Scalability**: Tight coupling between transport and business logic makes scaling difficult.

### Solution Approach
- **WebSockets:** Socket.IO provides persistent bidirectional connections for sub-second edit delivery.
- **EventBus (Pub/Sub):** Each document operates as a room. An internal EventBus decouples the transport layer from business logic for multi-server scalability.
- **Operational Transformation (OT):** Resolves concurrent edits using a Strategy pattern to transform positions and guarantee a consistent result.
- **Authentication:** JWT tokens secure both the REST API and the WebSocket handshake.

---

## 2. System Design Optimization
We applied System Design principles to improve scalability, performance, and architecture:
- **Decoupled Architecture:** By introducing an `EventBus`, the WebSocket connection layer is strictly decoupled from the `DocumentStateManager`. This means the state manager can be independently scaled and eventually replaced by a distributed Pub/Sub mechanism like Redis.
- **Efficient Conflict Resolution (OT):** Instead of saving full document snapshots on every keystroke, the system processes lightweight operational transformations, significantly reducing database I/O and network payload sizes.
- **Batched Persistence:** Document state is preserved in memory and periodically snapshotted to MongoDB (e.g., every 10 operations) to optimize database write performance.
- **State Encapsulation via Subject:** The Observer pattern limits memory usage by tracking active users and connection pooling centrally per document, rather than globally.

---

## 3. OOP Concepts Used
- **Encapsulation:** The `DocumentSubject` class hides its internal state (active users, history queue) and exposes behavior through specific methods like `subscribe()`, `unsubscribe()`, and `notifyAll()`. External code cannot arbitrarily mutate the socket lists.
- **Abstraction:** The `TransformStrategy` serves as an abstract base class that defines a contract (`transform()` and `apply()`) without specifying implementation details. Callers interact with this abstraction rather than the concrete operations.
- **Inheritance:** `InsertStrategy` and `DeleteStrategy` inherit from `TransformStrategy`. They receive the interface contract and override the transformation methods with logic specific to character insertion or deletion.
- **Polymorphism:** The `OTContext` retrieves different strategy objects dynamically at runtime. The context invokes `strategy.transform()` without knowing whether it is handling an insert or delete, successfully resolving the behavior polymorphically.

---

## 4. Design Patterns Implemented

1. **Observer Pattern**
   - **Where:** `DocumentSubject.js`
   - **Why:** Real-time collaboration requires broadcasting changes to all connected users. This pattern decouples the event source from socket consumers, allowing the system to instantly notify all subscribed clients when a document mutation occurs.

2. **Strategy Pattern**
   - **Where:** `ot.js` (Operational Transformation Engine)
   - **Why:** Different text operations (e.g., insert vs. delete) require distinct transformation logic. Instead of hardcoding conditional `if/else` statements, the Strategy pattern allows adding new operation types cleanly, ensuring the core logic remains open for extension.

3. **Singleton Pattern**
   - **Where:** `db.js` and `EventBus.js`
   - **Why:** Essential for resources that must exist as a single instance per application lifecycle, preventing redundant database connections or fragmented event channels.

---

## 5. SOLID Principles Reflection

1. **Single Responsibility Principle (SRP):** Each class has one focus. `DatabaseConnection` only handles MongoDB connectivity. `OTContext` solely deals with transformation logic. `SocketManager` manages only WebSocket payloads.
2. **Open/Closed Principle (OCP):** The system is open for extension but closed for modification. New formatting operations (like bold/italic) can be added as new `TransformStrategy` subclasses without modifying the base `OTContext`.
3. **Liskov Substitution Principle (LSP):** `InsertStrategy` and `DeleteStrategy` seamlessly replace the `TransformStrategy` interface and work predictably inside the OT engine without crashing the system.
4. **Interface Segregation Principle (ISP):** Component interfaces are focused. `DocumentSubject` provides specific notification methods (`notifyAll`, `notifyOthers`, `notifyDirect`) rather than forcing a monolithic notification pipeline.
5. **Dependency Inversion Principle (DIP):** The transport layer (`SocketManager`) depends on abstract business logic interfaces (`DocumentStateManager`), which in turn depends on an abstract message bus (`EventBus`), avoiding direct dependencies on MongoDB models.


---

## 7. Test Cases and Results

| Test Case Category | Description | Expected Result | Status |
|--------------------|-------------|-----------------|--------|
| **Real-Time Editing** | User A types "hello", User B types "world" at the same position. | Both words appear in the document without data loss. | **Pass** |
| **Real-Time Editing** | User pastes a 10,000-character block. | Document syncs successfully via full-replace fallback. | **Pass** |
| **Conflict Resolution** | User A deletes text while User B inserts at the same region. | Both operations correctly transformed by OT strategy. | **Pass** |
| **Presence & Access** | Viewer role user attempts to type in the document. | Textarea disabled locally; server rejects the operation. | **Pass** |
| **Version History** | User types 10+ characters triggering auto-snapshot. | A version snapshot is successfully saved in MongoDB. | **Pass** |
| **Version History** | User clicks restore on a past version. | Document content reverts; all active clients instantly update. | **Pass** |
