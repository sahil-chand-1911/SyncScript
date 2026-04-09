// Operation Format: { type: 'insert' | 'delete', position: number, character: string, version: number, id?: string }

export const applyOperation = (content: string, op: any) => {
  if (!op) return content;
  
  if (op.type === 'insert') {
    return content.slice(0, op.position) + op.character + content.slice(op.position);
  } else if (op.type === 'delete') {
    return content.slice(0, op.position) + content.slice(op.position + op.character.length);
  }
  return content;
};

// Generates an operation from a string change natively (simplistic diffing)
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

  // If we just inserted text
  if (oldEnd < start && newEnd >= start) {
    return {
      type: 'insert',
      position: start,
      character: newStr.substring(start, newEnd + 1),
      version
    };
  }
  
  // If we just deleted text
  if (newEnd < start && oldEnd >= start) {
    return {
      type: 'delete',
      position: start,
      character: oldStr.substring(start, oldEnd + 1),
      version
    };
  }

  // Replacement (delete then insert). MVP handles this as two ops or single chunk. We'll return null for complex scenarios in this basic version, but standard JS inputs usually are contiguous.
  // We'll treat standard single char replace as a delete + insert, but we can only return one here natively.
  // In a robust system, we would return [] array of ops. For this MVP, if it's complex, we just fallback.
  return null;
};
