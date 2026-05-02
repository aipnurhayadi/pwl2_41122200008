export function normalizePaginatedResponse(payload, limit, offset) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      limit,
      offset,
    };
  }

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: Number.isFinite(payload?.total) ? payload.total : 0,
    limit: Number.isFinite(payload?.limit) ? payload.limit : limit,
    offset: Number.isFinite(payload?.offset) ? payload.offset : offset,
  };
}
