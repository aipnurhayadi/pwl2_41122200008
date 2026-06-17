import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import CoursePreferenceSortableList from "@/components/dataset-detail/CoursePreferenceSortableList";

const MAX_RANKED_COURSES = 7;

export default function LecturerPreferencesTab({ datasetId, embedded = false }) {
  const { token } = useAuth();

  const [courses, setCourses] = useState([]);
  const [allowedCourseIds, setAllowedCourseIds] = useState([]);
  const [rankedCourseIds, setRankedCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allowedCourses = useMemo(() => {
    const allowedSet = new Set(allowedCourseIds.map(String));
    return courses.filter((course) => allowedSet.has(String(course.id)));
  }, [courses, allowedCourseIds]);

  const loadData = useCallback(async () => {
    if (!datasetId || !token) return;

    setLoading(true);
    try {
      const [coursesRes, prefRes, constraintsRes] = await Promise.all([
        fetch(`/api/datasets/${datasetId}/courses/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/datasets/${datasetId}/lecturer-preferences/my`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/datasets/${datasetId}/lecturer-preferences/my/constraints`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!coursesRes.ok) {
        const body = await coursesRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat daftar mata kuliah");
      }
      if (!prefRes.ok) {
        const body = await prefRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat preferensi dosen");
      }
      if (!constraintsRes.ok) {
        const body = await constraintsRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat batasan dosen");
      }

      const courseBody = await coursesRes.json();
      const courseRows = Array.isArray(courseBody) ? courseBody : courseBody.items ?? [];
      setCourses(courseRows);

      const pref = await prefRes.json();
      const constraints = await constraintsRes.json();
      const allowed = (constraints.allowed_course_ids ?? []).map(String);
      setAllowedCourseIds(allowed);

      const savedOrder = [...(pref.course_rankings ?? [])]
        .sort((a, b) => a.rank_order - b.rank_order)
        .map((row) => String(row.course_id))
        .filter((id) => allowed.includes(id));

      const missing = allowed.filter((id) => !savedOrder.includes(id));
      const missingSorted = [...missing].sort((a, b) => {
        const courseA = courseRows.find((c) => String(c.id) === a);
        const courseB = courseRows.find((c) => String(c.id) === b);
        return String(courseA?.code ?? "").localeCompare(String(courseB?.code ?? ""));
      });

      setRankedCourseIds([...savedOrder, ...missingSorted]);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [datasetId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const validateForm = () => {
    if (allowedCourseIds.length === 0) {
      return "Belum ada mata kuliah yang diizinkan. Hubungi admin untuk mapping MK.";
    }

    if (rankedCourseIds.length < 1) {
      return "Minimal 1 mata kuliah pada ranking.";
    }

    if (rankedCourseIds.length > MAX_RANKED_COURSES) {
      return `Maksimal ${MAX_RANKED_COURSES} mata kuliah pada ranking.`;
    }

    const allowedIds = new Set(allowedCourseIds.map(String));
    if (rankedCourseIds.some((id) => !allowedIds.has(id))) {
      return "Ada mata kuliah yang tidak diizinkan oleh batasan admin.";
    }

    if (rankedCourseIds.length !== allowedCourseIds.length) {
      return "Daftar ranking harus mencakup semua mata kuliah yang diizinkan admin.";
    }

    const uniqueCourses = new Set(rankedCourseIds);
    if (uniqueCourses.size !== rankedCourseIds.length) {
      return "Mata kuliah ranking tidak boleh duplikat.";
    }

    return null;
  };

  const handleSave = async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const payload = {
      course_rankings: rankedCourseIds.map((courseId, index) => ({
        course_id: Number(courseId),
        rank_order: index + 1,
      })),
      time_preferences: [],
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/lecturer-preferences/my`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal menyimpan preferensi dosen");
      }

      await res.json();
      toast.success("Preferensi dosen berhasil disimpan.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-xl border bg-card p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 space-y-2">
        <div className="flex flex-wrap items-start gap-3">
          {!embedded && (
            <div className="grow">
              <h2 className="text-xl font-bold">Preferensi Mengajar Dosen</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Urutkan mata kuliah yang telah ditetapkan admin sesuai prioritas Anda.
              </p>
            </div>
          )}
          {embedded && (
            <div className="grow">
              <p className="text-sm text-muted-foreground">
                Urutkan mata kuliah yang telah ditetapkan admin sesuai prioritas Anda.
              </p>
            </div>
          )}
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Ranking Mata Kuliah (1-{MAX_RANKED_COURSES})</h3>
          <p className="text-sm text-muted-foreground">
            Mata kuliah ditetapkan oleh admin. Drag untuk mengubah urutan prioritas.
          </p>
        </div>

        <CoursePreferenceSortableList
          rankedCourseIds={rankedCourseIds}
          courses={allowedCourses.length > 0 ? allowedCourses : courses}
          allowedCourseIds={allowedCourseIds}
          onChange={setRankedCourseIds}
          disabled={saving}
        />
      </section>
    </div>
  );
}
