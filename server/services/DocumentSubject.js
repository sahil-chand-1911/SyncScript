/**
 * DocumentSubject — Observer Pattern Implementation.
 *
 * Each instance represents one document room. It manages:
 *   1. A list of observer sockets (clients editing this document)
 *   2. An in-memory OT history queue for conflict resolution
 *   3. An active users registry for real-time presence tracking
 *
 * SOLID Principles:
 *   - Single Responsibility: Manages observer subscriptions and
 *     notifications. Does NOT handle persistence or OT math.
 *   - Interface Segregation: Provides separate notification methods
 *     (notifyAll, notifyOthers, notifyDirect) so callers only use
 *     what they need.
 *   - Open/Closed: New notification strategies can be added without
 *     modifying existing methods.
 *
 * SCALING NOTE:
 *   In a multi-server deployment, the activeUsers Map would be backed
 *   by a Redis Hash (HSET/HGETALL), and observer notifications would
 *   flow through the Socket.IO Redis adapter instead of local iteration.
 *
 * @module services/DocumentSubject
 */
class DocumentSubject {
  /**
   * @param {string} documentId - The unique document identifier.
   */
  constructor(documentId) {
    /** @type {string} */
    this.documentId = documentId;

    /** @type {Array<Socket>} Sockets subscribed to this document */
    this.observers = [];

    /** @type {Array<object>} In-memory OT operation history queue */
    this.history = [];

    /** @type {Map<string, {id: string, name: string, email: string}>} */
    this.activeUsers = new Map();
  }

  // ============================================================
  // Observer Lifecycle
  // ============================================================

  /**
   * Subscribes a socket to this document and registers user presence.
   * Broadcasts the updated user list to all connected clients.
   * @param {Socket} observer - The socket to subscribe.
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

      // Broadcast updated presence list to ALL clients (including joiner)
      this.notifyAll('active-users', this.getActiveUsers());
      // Notify others about the new arrival
      this.notifyOthers(observer, 'user-joined', observer.user || { name: observer.id });
    }
  }

  /**
   * Unsubscribes a socket and removes their presence.
   * Broadcasts the updated user list to remaining clients.
   * @param {Socket} observer - The socket to unsubscribe.
   */
  unsubscribe(observer) {
    this.observers = this.observers.filter((obs) => obs !== observer);
    this.activeUsers.delete(observer.id);

    // Notify remaining clients about the departure
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

  // ============================================================
  // Notification Methods (Interface Segregation)
  // ============================================================

  /**
   * Notifies ALL observers in the room (broadcast).
   * @param {string} eventName - The socket event name.
   * @param {*} payload - The data to emit.
   */
  notifyAll(eventName, payload) {
    this.observers.forEach((observer) => {
      observer.emit(eventName, payload);
    });
  }

  /**
   * Notifies all observers EXCEPT the sender (fan-out).
   * Used after an operation is applied to avoid echoing back to the sender.
   * @param {Socket} skipObserver - The observer to exclude.
   * @param {string} eventName - The socket event name.
   * @param {*} payload - The data to emit.
   */
  notifyOthers(skipObserver, eventName, payload) {
    this.observers.forEach((observer) => {
      if (observer !== skipObserver) {
        observer.emit(eventName, payload);
      }
    });
  }

  /**
   * Sends a notification to a single specific observer (unicast).
   * Used for acknowledgements (e.g. operation-acknowledged).
   * @param {Socket} observer - The target observer.
   * @param {string} eventName - The socket event name.
   * @param {*} payload - The data to emit.
   */
  notifyDirect(observer, eventName, payload) {
    if (this.observers.includes(observer)) {
      observer.emit(eventName, payload);
    }
  }

  // ============================================================
  // OT History Management
  // ============================================================

  /**
   * Appends an operation to the in-memory history queue.
   * Used by OTContext.catchUp() for conflict resolution.
   * @param {object} op - The transformed operation to store.
   */
  addHistory(op) {
    this.history.push(op);
  }

  /**
   * Retrieves the current operation history.
   * @returns {Array<object>} The history queue.
   */
  getHistory() {
    return this.history;
  }
}

/**
 * DocumentManager — Factory Pattern + Object Pool.
 *
 * Ensures exactly one DocumentSubject exists per document ID.
 * Lazily creates subjects on first access and provides cleanup.
 *
 * Exported as a Singleton instance.
 *
 * @example
 *   const subject = DocumentManager.getSubject('my-doc-id');
 *   subject.subscribe(socket);
 */
class DocumentManager {
  constructor() {
    /** @type {Map<string, DocumentSubject>} */
    this.subjects = new Map();
  }

  /**
   * Gets or creates a DocumentSubject for the specified document.
   * @param {string} documentId - The document identifier.
   * @returns {DocumentSubject} The subject instance.
   */
  getSubject(documentId) {
    if (!this.subjects.has(documentId)) {
      this.subjects.set(documentId, new DocumentSubject(documentId));
    }
    return this.subjects.get(documentId);
  }

  /**
   * Removes a subject from the pool (cleanup when no observers remain).
   * @param {string} documentId - The document identifier to remove.
   */
  destroySubject(documentId) {
    this.subjects.delete(documentId);
  }
}

module.exports = new DocumentManager();
