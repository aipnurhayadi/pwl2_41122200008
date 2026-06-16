export function getRowNumber(page, pageSize, index) {
  return (page - 1) * pageSize + index + 1;
}
