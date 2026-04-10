/**
 * Implementation of the Subject in the Observer Pattern.
 * Manages a list of observers (sockets) and a history pool for OT synchronization.
 */
class DocumentSubject {
  constructor(documentId) {
    this.documentId = documentId;
    this.observers = []; // Sockets/Clients subscribed to this document
    this.history = [];   // Memory queue holding OT history
  }

  /**
   * Attaches an observer (socket) to the subject.
   * @param {Socket} observer - The observer to add.
   */
  subscribe(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      
      // Notify others in room
      this.notifyOthers(observer, 'user-joined', observer.id);
    }
  }

  /**
   * Detaches an observer from the subject.
   */
  unsubscribe(observer) {
    this.observers = this.observers.filter((obs) => obs !== observer);
    this.notifyOthers(observer, 'user-left', observer.id);
  }

  /**
   * Notifies all observers except the one specified (usually the sender).
   * @param {Socket} skipObserver - The observer to exclude from notification.
   * @param {string} eventName - The socket event name.
   * @param {any} payload - The data to send.
   */
  notifyOthers(skipObserver, eventName, payload) {
    this.observers.forEach((observer) => {
      if (observer !== skipObserver) {
        observer.emit(eventName, payload);
      }
    });
  }

  /**
   * Sends a notification specifically to one observer.
   */
  notifyDirect(observer, eventName, payload) {
    if (this.observers.includes(observer)) {
      observer.emit(eventName, payload);
    }
  }

  /**
   * Adds an operation to the subject's local history for OT catch-up.
   */
  addHistory(op) {
    this.history.push(op);
  }

  /**
   * Retrieves the current history of operations.
   */
  getHistory() {
    return this.history;
  }
}

/**
 * Subject Pool Manager (Factory Pattern).
 * Ensures that each document has exactly one subject instance.
 */
class DocumentManager {
  constructor() {
    this.subjects = new Map();
  }

  /**
   * Gets or creates a Subject for a specific document.
   */
  getSubject(documentId) {
    if (!this.subjects.has(documentId)) {
      this.subjects.set(documentId, new DocumentSubject(documentId));
    }
    return this.subjects.get(documentId);
  }

  /**
   * Cleanup method to remove a subject from memory.
   */
  destroySubject(documentId) {
    this.subjects.delete(documentId);
  }
}

module.exports = new DocumentManager();
