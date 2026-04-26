/**
 * Operational Transformation (OT) Engine — Strategy Pattern.
 *
 * This module implements the core OT algorithm used for real-time
 * collaborative editing. It resolves conflicts when multiple users
 * edit the same document concurrently.
 *
 * Architecture:
 *   - TransformStrategy (Abstract): Defines the interface for transform/apply.
 *   - InsertStrategy: Handles position adjustment for insert operations.
 *   - DeleteStrategy: Handles position adjustment for delete operations.
 *   - OTContext: The context class that selects and applies strategies.
 *
 * SOLID Principles:
 *   - Open/Closed: New operation types (e.g. 'format', 'move') can be added
 *     by creating new Strategy subclasses without modifying OTContext.
 *   - Liskov Substitution: All strategies are interchangeable through the
 *     TransformStrategy interface.
 *   - Single Responsibility: Each strategy handles exactly one operation type.
 *   - Dependency Inversion: OTContext depends on the TransformStrategy
 *     abstraction, not concrete implementations.
 *
 * @module utils/ot
 */

// ============================================================
// Abstract Base Strategy
// ============================================================

/**
 * Abstract base class for OT transformation strategies.
 * Subclasses must implement transform() and apply().
 * @abstract
 */
class TransformStrategy {
  /**
   * Transforms a new operation against a previously applied operation.
   * Adjusts the position of the new operation to account for the
   * effect of the past operation on the document.
   * @param {object} newOp - The incoming operation to transform.
   * @param {object} pastOp - The already-applied operation.
   * @returns {object|null} The transformed operation, or null if redundant.
   * @abstract
   */
  transform(newOp, pastOp) {
    throw new Error('transform method must be implemented');
  }

  /**
   * Applies an operation to document content.
   * @param {string} content - Current document text.
   * @param {object} op - The operation to apply.
   * @returns {string} The content after applying the operation.
   * @abstract
   */
  apply(content, op) {
    throw new Error('apply method must be implemented');
  }
}

// ============================================================
// Concrete Strategies
// ============================================================

/**
 * InsertStrategy — Handles 'insert' type operations.
 *
 * Position adjustment rules against a past operation:
 *   - Past Insert at lower/equal position → shift right by inserted length
 *   - Past Delete at lower position → shift left by deleted length
 */
class InsertStrategy extends TransformStrategy {
  transform(newOp, pastOp) {
    const transformed = { ...newOp };
    if (pastOp.type === 'insert') {
      if (newOp.position < pastOp.position) {
        // Insert is before the past insert — no adjustment needed
      } else if (newOp.position > pastOp.position) {
        transformed.position += pastOp.character.length;
      } else {
        // Tie-breaker: same position, shift right (past operation wins priority)
        transformed.position += pastOp.character.length;
      }
    } else if (pastOp.type === 'delete') {
      if (newOp.position <= pastOp.position) {
        // Insert is at or before the deletion — no adjustment needed
      } else {
        transformed.position -= pastOp.character.length;
      }
    }
    return transformed;
  }

  apply(content, op) {
    return content.slice(0, op.position) + op.character + content.slice(op.position);
  }
}

/**
 * DeleteStrategy — Handles 'delete' type operations.
 *
 * Position adjustment rules against a past operation:
 *   - Past Insert at lower/equal position → shift right by inserted length
 *   - Past Delete at same position → null (redundant/conflicting delete)
 *   - Past Delete at lower position → shift left by deleted length
 */
class DeleteStrategy extends TransformStrategy {
  transform(newOp, pastOp) {
    const transformed = { ...newOp };
    if (pastOp.type === 'insert') {
      if (newOp.position < pastOp.position) {
        // Delete is before the past insert — no adjustment needed
      } else {
        transformed.position += pastOp.character.length;
      }
    } else if (pastOp.type === 'delete') {
      if (newOp.position < pastOp.position) {
        // Delete is before the past delete — no adjustment needed
      } else if (newOp.position > pastOp.position) {
        transformed.position -= pastOp.character.length;
      } else {
        // Same position: conflict — this delete is redundant
        return null;
      }
    }
    return transformed;
  }

  apply(content, op) {
    return content.slice(0, op.position) + content.slice(op.position + op.character.length);
  }
}

// ============================================================
// OT Context (Strategy Pattern entry point)
// ============================================================

/**
 * OTContext — The strategy context for Operational Transformation.
 *
 * Selects the appropriate strategy based on operation type and provides
 * high-level methods for transforming and applying operations.
 *
 * Exported as a Singleton instance.
 */
class OTContext {
  constructor() {
    /** @type {Record<string, TransformStrategy>} Strategy registry */
    this.strategies = {
      insert: new InsertStrategy(),
      delete: new DeleteStrategy(),
    };
  }

  /**
   * Retrieves the strategy for a given operation type.
   * @param {string} opType - 'insert' or 'delete'
   * @returns {TransformStrategy}
   * @throws {Error} If no strategy exists for the type.
   */
  getStrategy(opType) {
    const strategy = this.strategies[opType];
    if (!strategy) throw new Error(`Strategy for type "${opType}" not found.`);
    return strategy;
  }

  /**
   * Transforms a new operation against a single past operation.
   * @param {object} newOp - The incoming operation.
   * @param {object} pastOp - The historical operation to transform against.
   * @returns {object|null} Transformed operation, or null if redundant.
   */
  transform(newOp, pastOp) {
    if (!newOp || !pastOp) return newOp;
    return this.getStrategy(newOp.type).transform(newOp, pastOp);
  }

  /**
   * Catches up an operation against the full history of operations
   * that occurred after the operation's base version.
   * This is the core OT merge algorithm.
   *
   * @param {object} op - The operation to catch up.
   * @param {Array<object>} history - Array of past operations.
   * @returns {object|null} The fully transformed operation.
   */
  catchUp(op, history) {
    let transformedOp = { ...op };
    for (const pastOp of history) {
      if (!transformedOp) break;
      // Only transform against operations that happened after this op's base version
      if (pastOp.version >= op.version) {
        transformedOp = this.transform(transformedOp, pastOp);
      }
    }
    return transformedOp;
  }

  /**
   * Applies an operation to document content using the appropriate strategy.
   * @param {string} content - Current document content.
   * @param {object} op - Operation to apply.
   * @returns {string} Updated content.
   */
  applyOperation(content, op) {
    if (!op) return content;
    return this.getStrategy(op.type).apply(content, op);
  }
}

module.exports = new OTContext();
