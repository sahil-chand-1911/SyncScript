/**
 * Represents a single modification to a document.
 */
export interface Operation {
  type: 'insert' | 'delete';
  position: number;    // The index where the change occurs
  character: string;   // The text being inserted or deleted
  version: number;     // The base version this operation was created on
  id?: string;
}

/**
 * Applies a single OT operation to a string content.
 * @param content - Current document content.
 * @param op - The operation to apply.
 * @returns The updated content.
 */
export const applyOperation = (content: string, op: Operation | null) => {
  if (!op) return content;
  
  if (op.type === 'insert') {
    return content.slice(0, op.position) + op.character + content.slice(op.position);
  } else if (op.type === 'delete') {
    return content.slice(0, op.position) + content.slice(op.position + op.character.length);
  }
  return content;
};

/**
 * Generates an operation by comparing two versions of a string (diffing).
 * Optimized for single-contiguous-chunk changes typical in text editors.
 * @param oldStr - Content before the change.
 * @param newStr - Content after the change.
 * @param version - The base version for the generated operation.
 */
export const computeOperation = (oldStr: string, newStr: string, version: number) => {
  // Find start index where they differ
  let start = 0;
  while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) {
    start++;
  }

  // Find end index (from the back)
  let oldEnd = oldStr.length - 1;
  let newEnd = newStr.length - 1;
  while (oldEnd >= start && newEnd >= start && oldStr[oldEnd] === newStr[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  // If text was inserted
  if (oldEnd < start && newEnd >= start) {
    return {
      type: 'insert' as const,
      position: start,
      character: newStr.substring(start, newEnd + 1),
      version
    };
  }
  
  // If text was deleted
  if (newEnd < start && oldEnd >= start) {
    return {
      type: 'delete' as const,
      position: start,
      character: oldStr.substring(start, oldEnd + 1),
      version
    };
  }

  // If both start/end diffed (Replacement), it's complex for this basic OT model.
  // Standard keystrokes are handled above.
  return null;
};
