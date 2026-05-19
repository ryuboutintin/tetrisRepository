function rotate(matrix) {
  const R = matrix.length, C = matrix[0].length;
  return Array.from({ length: C }, (_, c) =>
    Array.from({ length: R }, (_, r) => matrix[R - 1 - r][c])
  );
}
