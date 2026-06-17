import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

export default function LecturerCourseMappingDialog({
  open,
  onOpenChange,
  datasetId,
  lecturer,
}) {
  const { token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!open || !datasetId || !lecturer?.id || !token) return;

    setLoading(true);
    try {
      const [coursesRes, allowedRes] = await Promise.all([
        fetch(`/api/datasets/${datasetId}/courses/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/datasets/${datasetId}/lecturers/${lecturer.id}/allowed-courses`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!coursesRes.ok) {
        const body = await coursesRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat mata kuliah");
      }
      if (!allowedRes.ok) {
        const body = await allowedRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat mapping mata kuliah");
      }

      const courseBody = await coursesRes.json();
      const courseRows = Array.isArray(courseBody) ? courseBody : courseBody.items ?? [];
      setCourses(courseRows);

      const allowedBody = await allowedRes.json();
      setSelectedIds(new Set((allowedBody.course_ids ?? []).map(String)));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [open, datasetId, lecturer?.id, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleCourse = (courseId) => {
    const id = String(courseId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!datasetId || !lecturer?.id || !token) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/lecturers/${lecturer.id}/allowed-courses`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            course_ids: [...selectedIds].map(Number),
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal menyimpan mapping mata kuliah");
      }

      toast.success("Mapping mata kuliah berhasil disimpan");
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mapping Mata Kuliah — {lecturer?.name ?? lecturer?.code}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {courses.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada mata kuliah di dataset.</p>
            )}
            {courses.map((course) => {
              const id = String(course.id);
              const checked = selectedIds.has(id);
              return (
                <label
                  key={course.id}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggleCourse(course.id)}
                  />
                  <div>
                    <p className="font-medium">{course.code}</p>
                    <p className="text-sm text-muted-foreground">{course.name}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
