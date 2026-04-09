// Observer pattern implementation for explicit decoupling
class DocumentSubject {
  constructor(documentId) {
    this.documentId = documentId;
    this.observers = []; // Sockets/Clients subscribed to this document
    this.history = [];   // Memory queue holding OT history
  }

  // Attach an observer
  subscribe(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      
      // Notify others in room
      this.notifyOthers(observer, 'user-joined', observer.id);
    }
  }

  // Detach an observer
  unsubscribe(observer) {
    this.observers = this.observers.filter((obs) => obs !== observer);
    this.notifyOthers(observer, 'user-left', observer.id);
  }

  // Notify everyone in the subject pool EXCEPT the ignoreObserver (which is usually the sender)
  notifyOthers(skipObserver, eventName, payload) {
    this.observers.forEach((observer) => {
      if (observer !== skipObserver) {
        observer.emit(eventName, payload);
      }
    });
  }

  // Send specifically to sender
  notifyDirect(observer, eventName, payload) {
    if (this.observers.includes(observer)) {
      observer.emit(eventName, payload);
    }
  }

  addHistory(op) {
    this.history.push(op);
  }

  getHistory() {
    return this.history;
  }
}

// Manager to handle Document Subjects collectively (Factory / Pool)
class DocumentManager {
  constructor() {
    this.subjects = new Map();
  }

  getSubject(documentId) {
    if (!this.subjects.has(documentId)) {
      this.subjects.set(documentId, new DocumentSubject(documentId));
    }
    return this.subjects.get(documentId);
  }

  destroySubject(documentId) {
    this.subjects.delete(documentId);
  }
}

module.exports = new DocumentManager();
