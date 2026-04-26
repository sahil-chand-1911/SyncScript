/**
 * Implementation of the Subject in the Observer Pattern.
 * Manages a list of observers (sockets), a history pool for OT synchronization,
 * and an active users registry for presence tracking.
 */
class DocumentSubject {
  constructor(documentId) {
    this.documentId = documentId;
    this.observers = [];      // Sockets/Clients subscribed to this document
    this.history = [];         // Memory queue holding OT history
    this.activeUsers = new Map(); // socketId -> { id, name, email } presence registry
  }

  /**
   * Attaches an observer (socket) to the subject and registers their presence.
   * Broadcasts the updated active users list to all clients in the room.
   * @param {Socket} observer - The observer to add.
   */
  subscribe(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);

      // Register user presence from the authenticated socket context
      if (observer.user) {
        this.activeUsers.set(observer.id, {
          id: observer.user.id,
          name: observer.user.name,
          email: observer.user.email,
        });
      }

      // Broadcast updated presence list to ALL clients in room (including the joiner)
      this.notifyAll('active-users', this.getActiveUsers());
      // Notify others specifically about who joined
      this.notifyOthers(observer, 'user-joined', observer.user || { name: observer.id });
    }
  }

  /**
   * Detaches an observer from the subject and removes their presence.
   * Broadcasts the updated active users list to remaining clients.
   */
  unsubscribe(observer) {
    this.observers = this.observers.filter((obs) => obs !== observer);
    this.activeUsers.delete(observer.id);

    // Notify remaining observers about the departure and updated list
    this.notifyOthers(observer, 'user-left', observer.user || { name: observer.id });
    this.notifyAll('active-users', this.getActiveUsers());
  }

  /**
   * Returns the list of currently active users in this document room.
   * @returns {Array<{id: string, name: string, email: string}>}
   */
  getActiveUsers() {
    return Array.from(this.activeUsers.values());
  }

  /**
   * Notifies ALL observers in the room (including the sender).
   * @param {string} eventName - The socket event name.
   * @param {any} payload - The data to send.
   */
  notifyAll(eventName, payload) {
    this.observers.forEach((observer) => {
      observer.emit(eventName, payload);
    });
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
