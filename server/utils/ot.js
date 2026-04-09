/**
 * Transforms newOp against pastOp
 * Operations have format: { type: 'insert' | 'delete', position: number, character: string, version: number }
 */
const transform = (newOp, pastOp) => {
  if (!newOp) return null; // If previously marked redundant

  const transformed = { ...newOp };

  if (pastOp.type === 'insert') {
    if (newOp.type === 'insert') {
      if (newOp.position < pastOp.position) {
        // no change
      } else if (newOp.position > pastOp.position) {
        transformed.position += pastOp.character.length;
      } else {
        // Tie breaker: pastOp was processed first by the server, so it wins.
        // The newOp shifts to the right of pastOp.
        transformed.position += pastOp.character.length;
      }
    } else if (newOp.type === 'delete') {
      if (newOp.position < pastOp.position) {
        // no change
      } else {
        // The deletion happens after the insertion, so shift its position to the right
        transformed.position += pastOp.character.length;
      }
    }
  } else if (pastOp.type === 'delete') {
    if (newOp.type === 'insert') {
      if (newOp.position <= pastOp.position) {
        // no change
      } else {
        // It's after the deletion
        transformed.position -= pastOp.character.length;
      }
    } else if (newOp.type === 'delete') {
      if (newOp.position < pastOp.position) {
        // no change
      } else if (newOp.position > pastOp.position) {
        transformed.position -= pastOp.character.length;
      } else {
        // Same position deleted twice, making newOp redundant
        return null;
      }
    }
  }

  return transformed;
};

const catchUpOperation = (op, history) => {
  let transformedOp = { ...op };
  
  // Apply all past operations that happened after the version this op was based on
  for (const pastOp of history) {
    if (!transformedOp) break;
    // Strictly, in full OT, history ops should've all been > op.version at base,
    // but assuming history is already sorted chronologically:
    if (pastOp.version >= op.version) {
      transformedOp = transform(transformedOp, pastOp);
    }
  }

  return transformedOp;
};

const applyOperation = (content, op) => {
  if (!op) return content;
  
  if (op.type === 'insert') {
    return content.slice(0, op.position) + op.character + content.slice(op.position);
  } else if (op.type === 'delete') {
    return content.slice(0, op.position) + content.slice(op.position + op.character.length);
  }
  return content;
};

module.exports = { transform, catchUpOperation, applyOperation };
