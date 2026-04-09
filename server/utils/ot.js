// Base Strategy Interface
class TransformStrategy {
  transform(newOp, pastOp) {
    throw new Error('transform method must be implemented');
  }

  apply(content, op) {
    throw new Error('apply method must be implemented');
  }
}

class InsertStrategy extends TransformStrategy {
  transform(newOp, pastOp) {
    const transformed = { ...newOp };
    if (pastOp.type === 'insert') {
      if (newOp.position < pastOp.position) {
        // no change
      } else if (newOp.position > pastOp.position) {
        transformed.position += pastOp.character.length;
      } else {
        // Tie breaker
        transformed.position += pastOp.character.length;
      }
    } else if (pastOp.type === 'delete') {
      if (newOp.position <= pastOp.position) {
        // no change
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

class DeleteStrategy extends TransformStrategy {
  transform(newOp, pastOp) {
    const transformed = { ...newOp };
    if (pastOp.type === 'insert') {
      if (newOp.position < pastOp.position) {
        // no change
      } else {
        transformed.position += pastOp.character.length;
      }
    } else if (pastOp.type === 'delete') {
      if (newOp.position < pastOp.position) {
        // no change
      } else if (newOp.position > pastOp.position) {
        transformed.position -= pastOp.character.length;
      } else {
        return null; // Redundant delete
      }
    }
    return transformed;
  }

  apply(content, op) {
    return content.slice(0, op.position) + content.slice(op.position + op.character.length);
  }
}

// The Transform Context
class OTContext {
  constructor() {
    this.strategies = {
      insert: new InsertStrategy(),
      delete: new DeleteStrategy()
    };
  }

  getStrategy(opType) {
    const strategy = this.strategies[opType];
    if (!strategy) throw new Error(`Strategy for type ${opType} not found.`);
    return strategy;
  }

  transform(newOp, pastOp) {
    if (!newOp || !pastOp) return newOp;
    return this.getStrategy(newOp.type).transform(newOp, pastOp);
  }

  catchUp(op, history) {
    let transformedOp = { ...op };
    for (const pastOp of history) {
      if (!transformedOp) break;
      if (pastOp.version >= op.version) {
        transformedOp = this.transform(transformedOp, pastOp);
      }
    }
    return transformedOp;
  }

  applyOperation(content, op) {
    if (!op) return content;
    return this.getStrategy(op.type).apply(content, op);
  }
}

module.exports = new OTContext();
