import { Button } from "@/components/ui/button";

export default function DataTablePagination({
  page,
  setPage,
  totalItems,
  pageSize = 10,
  itemLabel = "data",
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between border-t bg-muted/20">
      <p className="text-xs text-muted-foreground">
        Menampilkan {from}-{to} dari {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Sebelumnya
        </Button>
        <span className="text-xs text-muted-foreground min-w-14 text-center">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
