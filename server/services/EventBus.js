const EventEmitter = require('events');

/**
 * EventBus — Simulated Redis Pub/Sub Layer.
 *
 * This is a local in-process event bus that decouples the WebSocket transport
 * layer from document state management. All inter-component communication
 * flows through named channels on this bus.
 *
 * SCALING NOTE:
 * In production, this class would be replaced with a Redis Pub/Sub adapter
 * (e.g. using `ioredis`). The interface remains identical — only the transport
 * changes from in-process EventEmitter to cross-process Redis channels.
 *
 * Channel naming convention:
 *   doc:<documentId>:operation   — OT operations
 *   doc:<documentId>:changes     — Full content replacements
 *   doc:<documentId>:presence    — User join/leave events
 *   doc:<documentId>:ack         — Operation acknowledgements
 *
 * Design Pattern: Singleton (one bus per process)
 */
class EventBus {
  constructor() {
    if (EventBus._instance) {
      return EventBus._instance;
    }

    this.emitter = new EventEmitter();
    // Allow many listeners per channel (one per socket in the document room)
    this.emitter.setMaxListeners(500);
    this.metrics = {
      published: 0,
      delivered: 0,
    };

    EventBus._instance = this;
  }

  /**
   * Publish an event to a named channel.
   * In Redis mode, this would be: redis.publish(channel, JSON.stringify(payload))
   * @param {string} channel - The channel name (e.g. 'doc:my-doc:operation')
   * @param {object} payload - The data to publish.
   */
  publish(channel, payload) {
    this.metrics.published++;
    this.emitter.emit(channel, payload);
  }

  /**
   * Subscribe to a named channel.
   * In Redis mode, this would be: redis.subscribe(channel) + redis.on('message', ...)
   * @param {string} channel - The channel to listen on.
   * @param {Function} handler - Callback invoked with the payload.
   * @returns {Function} Unsubscribe function for cleanup.
   */
  subscribe(channel, handler) {
    this.emitter.on(channel, handler);
    return () => {
      this.emitter.off(channel, handler);
    };
  }

  /**
   * One-time subscription to a channel.
   * @param {string} channel
   * @param {Function} handler
   */
  once(channel, handler) {
    this.emitter.once(channel, handler);
  }

  /**
   * Returns the number of active listeners for a channel.
   * Useful for monitoring how many sockets are subscribed to a document.
   */
  listenerCount(channel) {
    return this.emitter.listenerCount(channel);
  }

  /**
   * Returns bus metrics for monitoring/debugging.
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Helper: builds a channel name for a document.
   * @param {string} documentId
   * @param {string} event - e.g. 'operation', 'changes', 'presence', 'ack'
   * @returns {string}
   */
  static channel(documentId, event) {
    return `doc:${documentId}:${event}`;
  }
}

module.exports = new EventBus();
