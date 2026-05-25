/** Shared sequential ID allocator for prefix-based schemes like C001 / N001 / S001. */

export function allocateSequentialId(
  prefix: string,
  existingIds: string[],
): string {
  let num = 1;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const n = parseInt(id.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n >= num) num = n + 1;
  }
  return `${prefix}${String(num).padStart(3, '0')}`;
}
