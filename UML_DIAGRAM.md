# SyncScript - Detailed UML Class Diagram

This document contains the visual technical architecture of the SyncScript project represented as a UML Class Diagram.

```mermaid
classDiagram
    direction TB

    %% Backend Structure
    class AppServer {
        -app: Express
        -server: HTTPServer
        -io: SocketIO
        -port: number
        +initializeDependencies() Promise
        +initializeMiddleware() void
        +initializeRoutes() void
        +initializeSockets() void
        +start() void
    }

    class SocketManager {
        -io: SocketIO
        -activeSockets: Map~string, string~
        +handleConnection(socket: Socket) void
        +handleJoinDocument(socket: Socket, documentId: string) Promise
        +handleLeaveDocument(socket: Socket, documentId: string) void
        +handleSendOperation(socket: Socket, data: any) Promise
    }

    class DocumentManager {
        <<Singleton>>
        -subjects: Map~string, DocumentSubject~
        +getSubject(documentId: string) DocumentSubject
        +destroySubject(documentId: string) void
    }

    class DocumentSubject {
        +documentId: string
        -observers: List~Socket~
        -history: List~Operation~
        +subscribe(observer: Socket) void
        +unsubscribe(observer: Socket) void
        +notifyOthers(skip: Socket, event: string, payload: any) void
        +notifyDirect(observer: Socket, event: string, payload: any) void
        +addHistory(op: Operation) void
        +getHistory() Operation[]
    }

    %% OT Strategy Pattern
    class OTContext {
        <<Context>>
        -strategies: Map~string, TransformStrategy~
        +getStrategy(opType: string) TransformStrategy
        +transform(newOp: Operation, pastOp: Operation) Operation
        +catchUp(op: Operation, history: Operation[]) Operation
        +applyOperation(content: string, op: Operation) string
    }

    class TransformStrategy {
        <<Abstract>>
        +transform(newOp: Operation, pastOp: Operation) Operation*
        +apply(content: string, op: Operation) string*
    }

    class InsertStrategy {
        +transform(newOp, pastOp) Operation
        +apply(content, op) string
    }

    class DeleteStrategy {
        +transform(newOp, pastOp) Operation
        +apply(content, op) string
    }

    %% Database & Models
    class DatabaseConnection {
        <<Singleton>>
        -instance: DatabaseConnection
        -connection: Mongoose
        +getInstance() DatabaseConnection
        +connect() Promise~Mongoose~
    }

    class DocumentModel {
        <<Mongoose Model>>
        +documentId: string
        +data: string
        +version: number
        +timestamps: true
    }

    %% Data Structures
    class Operation {
        <<Interface>>
        +type: "insert" | "delete"
        +position: number
        +character: string
        +version: number
    }

    %% Relationships
    AppServer *-- SocketManager : composition (1:1)
    SocketManager --> DocumentManager : uses
    DocumentManager "1" o-- "*" DocumentSubject : aggregates (subject pool)
    DocumentSubject "1" o-- "*" Operation : contains (history)
    SocketManager ..> OTContext : depends on (math)
    SocketManager ..> DocumentModel : interacts with
    
    OTContext "1" *-- "2" TransformStrategy : composes (strategies)
    TransformStrategy <|-- InsertStrategy : inheritance
    TransformStrategy <|-- DeleteStrategy : inheritance
    
    DatabaseConnection ..> DocumentModel : configures

    %% Note
    note for DocumentManager "Ensures one Subject per documentID"
    note for OTContext "Strategy Pattern for OT Transformations"
```

---

### Legend
| Symbol | Meaning | Description |
|---|---|---|
| `*--` | **Composition** | Strong ownership; the child cannot exist without the parent. |
| `o--` | **Aggregation** | Weak ownership; a collection of objects that can exist independently. |
| `<|--` | **Inheritance** | "Is-a" relationship (e.g., InsertStrategy is a TransformStrategy). |
| `-->` | **Association** | "Uses" or "Has-a" relationship. |
| `..>` | **Dependency** | Uses another class as a parameter or for a specific task. |
| `+` | **Public** | Member is accessible from outside the class. |
| `-` | **Private** | Member is restricted to internal class logic. |
