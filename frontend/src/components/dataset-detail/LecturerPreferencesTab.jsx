import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DAY_LABELS = {
  MON: "Senin",
  TUE: "Selasa",
  WED: "Rabu",
  THU: "Kamis",
  FRI: "Jumat",
  SAT: "Sabtu",
  SUN: "Minggu",
};

const DAYS = Object.entries(DAY_LABELS);

const EMPTY_RANKS = [
  { rank_order: 1, course_id: "" },
  { rank_order: 2, course_id: "" },
  { rank_order: 3, course_id: "" },
];

const EMPTY_TIME_CHOICES = [
  { choice_order: 1, day: "", start_time_slot_id: "", end_time_slot_id: "" },
  { choice_order: 2, day: "", start_time_slot_id: "", end_time_slot_id: "" },
  { choice_order: 3, day: "", start_time_slot_id: "", end_time_slot_id: "" },
];

const EMPTY_COURSE_VALUE = "(Kosong)";
const EMPTY_DAY_VALUE = "(Kosong)";
const EMPTY_SLOT_VALUE = "(Kosong)";

function slotRangeLabel(slot) {
  if (!slot) return "(Kosong)";
  const start = slot.start_time ? String(slot.start_time).slice(0, 5) : "--:--";
  const end = slot.end_time ? String(slot.end_time).slice(0, 5) : "--:--";
  return `${start} - ${end}`;
}

export default function LecturerPreferencesTab({ datasetId }) {
  const { token } = useAuth();

  const [courses, setCourses] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [allowedCourseIds, setAllowedCourseIds] = useState([]);
  const [allowedTimeSlotIds, setAllowedTimeSlotIds] = useState([]);
  const [courseRanks, setCourseRanks] = useState(EMPTY_RANKS);
  const [timeChoices, setTimeChoices] = useState(EMPTY_TIME_CHOICES);
  const [mappedSlots, setMappedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sortedTimeSlots = useMemo(
    () =>
      [...timeSlots].sort((a, b) =>
        `${String(a.day)}-${String(a.start_time)}`.localeCompare(
          `${String(b.day)}-${String(b.start_time)}`,
        ),
      ),
    [timeSlots],
  );

  const slotById = useMemo(() => {
    const map = {};
    for (const slot of timeSlots) {
      map[String(slot.id)] = slot;
    }
    return map;
  }, [timeSlots]);

  const groupedTimeSlots = useMemo(() => {
    const grouped = {};
    for (const slot of sortedTimeSlots) {
      if (!grouped[slot.day]) grouped[slot.day] = [];
      grouped[slot.day].push(slot);
    }
    return grouped;
  }, [sortedTimeSlots]);

  const groupedMappedSlots = useMemo(() => {
    const grouped = {};
    for (const slot of mappedSlots) {
      const day = slot.day ?? "-";
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(slot);
    }
    for (const day of Object.keys(grouped)) {
      grouped[day].sort((a, b) => slotRangeLabel(a).localeCompare(slotRangeLabel(b)));
    }
    return grouped;
  }, [mappedSlots]);

  const selectedTimeSlotIds = useMemo(() => {
    const ids = new Set();
    for (const row of timeChoices) {
      if (row.start_time_slot_id) ids.add(row.start_time_slot_id);
      if (row.end_time_slot_id) ids.add(row.end_time_slot_id);
    }
    return ids;
  }, [timeChoices]);

  const availableCourseOptions = useMemo(() => {
    const selectedIds = new Set(courseRanks.map((row) => row.course_id).filter(Boolean));
    const allowedIds = new Set(allowedCourseIds.map(String));
    return (rankOrder) =>
      courses.filter((course) => {
        const current = courseRanks[rankOrder - 1]?.course_id ?? "";
        const courseId = String(course.id);
        const selectedElsewhere = selectedIds.has(courseId) && courseId !== current;
        const disallowedByAdmin = allowedIds.size > 0 && !allowedIds.has(courseId);
        return !selectedElsewhere && !disallowedByAdmin;
      });
  }, [courses, courseRanks, allowedCourseIds]);

  const loadData = useCallback(async () => {
    if (!datasetId || !token) return;

    setLoading(true);
    try {
      const [coursesRes, slotsRes, prefRes, constraintsRes] = await Promise.all([
        fetch(`/api/datasets/${datasetId}/courses/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/datasets/${datasetId}/time-slots/`, {
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
      if (!slotsRes.ok) {
        const body = await slotsRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat daftar timeslot");
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

      const slotBody = await slotsRes.json();
      const slotRows = Array.isArray(slotBody) ? slotBody : slotBody.items ?? [];
      setTimeSlots(slotRows);

      const slotDayById = {};
      for (const slot of slotRows) {
        slotDayById[String(slot.id)] = slot.day ?? "";
      }

      const pref = await prefRes.json();
      const constraints = await constraintsRes.json();
      setAllowedCourseIds((constraints.allowed_course_ids ?? []).map(String));
      setAllowedTimeSlotIds((constraints.allowed_time_slot_ids ?? []).map(String));

      const nextRanks = EMPTY_RANKS.map((row) => {
        const found = (pref.course_rankings ?? []).find((x) => x.rank_order === row.rank_order);
        return {
          rank_order: row.rank_order,
          course_id: found ? String(found.course_id) : "",
        };
      });
      setCourseRanks(nextRanks);

      const nextChoices = EMPTY_TIME_CHOICES.map((row) => {
        const found = (pref.time_preferences ?? []).find((x) => x.choice_order === row.choice_order);
        const startSlotId = found ? String(found.start_time_slot_id) : "";
        const endSlotId = found ? String(found.end_time_slot_id) : "";
        return {
          choice_order: row.choice_order,
          day: startSlotId ? slotDayById[startSlotId] ?? "" : "",
          start_time_slot_id: startSlotId,
          end_time_slot_id: endSlotId,
        };
      });
      setTimeChoices(nextChoices);

      setMappedSlots(pref.available_time_slots ?? []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [datasetId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setRankCourse = (rankOrder, value) => {
    const normalizedValue = value === EMPTY_COURSE_VALUE ? "" : value;
    setCourseRanks((prev) =>
      prev.map((row) =>
        row.rank_order === rankOrder ? { ...row, course_id: normalizedValue } : row,
      ),
    );
  };

  const setTimeChoiceDay = (choiceOrder, value) => {
    const normalizedDay = value === EMPTY_DAY_VALUE ? "" : value;
    setTimeChoices((prev) =>
      prev.map((row) => {
        if (row.choice_order !== choiceOrder) return row;
        return {
          ...row,
          day: normalizedDay,
          start_time_slot_id: "",
          end_time_slot_id: "",
        };
      }),
    );
  };

  const setTimeChoiceStartSlot = (choiceOrder, value) => {
    const normalizedSlot = value === EMPTY_SLOT_VALUE ? "" : value;
    setTimeChoices((prev) =>
      prev.map((row) =>
        row.choice_order === choiceOrder
          ? { ...row, start_time_slot_id: normalizedSlot, end_time_slot_id: "" }
          : row,
      ),
    );
  };

  const setTimeChoiceEndSlot = (choiceOrder, value) => {
    const normalizedSlot = value === EMPTY_SLOT_VALUE ? "" : value;
    setTimeChoices((prev) =>
      prev.map((row) =>
        row.choice_order === choiceOrder ? { ...row, end_time_slot_id: normalizedSlot } : row,
      ),
    );
  };

  const validateForm = () => {
    const selected = courseRanks.filter((row) => row.course_id);
    if (selected.length < 1) {
      return "Minimal pilih 1 mata kuliah pada ranking.";
    }

    const allowedIds = new Set(allowedCourseIds.map(String));
    if (allowedIds.size > 0 && selected.some((row) => row.course_id && !allowedIds.has(row.course_id))) {
      return "Ada mata kuliah yang tidak diizinkan oleh batasan admin.";
    }

    const uniqueCourses = new Set(selected.map((row) => row.course_id));
    if (uniqueCourses.size !== selected.length) {
      return "Mata kuliah ranking tidak boleh duplikat.";
    }

    for (let i = 0; i < courseRanks.length; i += 1) {
      if (!courseRanks[i].course_id) {
        for (let j = i + 1; j < courseRanks.length; j += 1) {
          if (courseRanks[j].course_id) {
            return "Ranking harus berurutan dari Rank 1 tanpa loncat.";
          }
        }
        break;
      }
    }

    for (const row of timeChoices) {
      const hasDay = Boolean(row.day);
      const hasStart = Boolean(row.start_time_slot_id);
      const hasEnd = Boolean(row.end_time_slot_id);
      if (!(hasDay === hasStart && hasStart === hasEnd)) {
        return "Setiap pilihan timeslot harus lengkap: pilih hari lalu range.";
      }

      if (hasDay && hasStart && hasEnd) {
        const daySlots = groupedTimeSlots[row.day] ?? [];
        const startIdx = daySlots.findIndex((slot) => String(slot.id) === row.start_time_slot_id);
        const endIdx = daySlots.findIndex((slot) => String(slot.id) === row.end_time_slot_id);
        if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) {
          return `Range pada Pilihan ${row.choice_order} tidak valid.`;
        }

        const allowedIds = new Set(allowedTimeSlotIds.map(String));
        if (allowedIds.size > 0) {
          for (const slot of daySlots.slice(startIdx, endIdx + 1)) {
            if (!allowedIds.has(String(slot.id))) {
              return "Ada timeslot yang tidak diizinkan oleh batasan admin.";
            }
          }
        }
      }
    }

    const filledChoices = timeChoices.filter((row) => row.day && row.start_time_slot_id && row.end_time_slot_id);
    if (filledChoices.length < 1) {
      return "Minimal isi 1 pilihan timeslot.";
    }

    const uniqueSlots = new Set(filledChoices.map((row) => `${row.start_time_slot_id}-${row.end_time_slot_id}`));
    if (uniqueSlots.size !== filledChoices.length) {
      return "Pilihan timeslot tidak boleh duplikat.";
    }

    let foundEmpty = false;
    for (const row of timeChoices) {
      const isFilled = Boolean(row.day && row.start_time_slot_id && row.end_time_slot_id);
      if (!isFilled) {
        foundEmpty = true;
        continue;
      }
      if (foundEmpty) {
        return "Pilihan timeslot harus berurutan dari Pilihan 1 tanpa loncat.";
      }
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
      course_rankings: courseRanks
        .filter((row) => row.course_id)
        .map((row) => ({
          course_id: Number(row.course_id),
          rank_order: row.rank_order,
        })),
      time_preferences: timeChoices
        .filter((row) => row.start_time_slot_id && row.end_time_slot_id)
        .map((row) => ({
          choice_order: row.choice_order,
          start_time_slot_id: Number(row.start_time_slot_id),
          end_time_slot_id: Number(row.end_time_slot_id),
        })),
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

      const body = await res.json();
      setMappedSlots(body.available_time_slots ?? []);
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
          <div className="grow">
            <h2 className="text-xl font-bold">Preferensi Mengajar Dosen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Isi ranking mata kuliah dan preferensi timeslot.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Ranking Mata Kuliah (1-3)</h3>
          <p className="text-sm text-muted-foreground">Pilih maksimal 3 mata kuliah yang paling dikuasai.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {courseRanks.map((row) => (
            <div key={row.rank_order} className="space-y-1">
              <Label>Rank {row.rank_order}</Label>
              <Select value={row.course_id} onValueChange={(v) => setRankCourse(row.rank_order, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="- Pilih Mata Kuliah -">
                    {row.course_id ? courses.find((course) => String(course.id) === row.course_id)?.name : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value={EMPTY_COURSE_VALUE}>(Kosong)</SelectItem>
                  {availableCourseOptions(row.rank_order).map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.code} - {course.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Pilihan Timeslot (1-3)</h3>
          <p className="text-sm text-muted-foreground">
            Untuk setiap pilihan, tentukan hari terlebih dulu lalu pilih range pada hari tersebut.
          </p>
        </div>

        <div className="grid gap-3">
          {timeChoices.map((row) => {
            const daySlots = groupedTimeSlots[row.day] ?? [];
            const allowedIds = new Set(allowedTimeSlotIds.map(String));
            const rowSlots = allowedIds.size > 0 ? daySlots.filter((slot) => allowedIds.has(String(slot.id))) : daySlots;
            const selectedStart = row.start_time_slot_id ? slotById[row.start_time_slot_id] : null;
            const selectedEnd = row.end_time_slot_id ? slotById[row.end_time_slot_id] : null;
            const startIdx = rowSlots.findIndex((slot) => String(slot.id) === row.start_time_slot_id);
            const endOptions = startIdx >= 0 ? rowSlots.slice(startIdx) : [];

            return (
              <div
                key={row.choice_order}
                className="grid gap-3 md:grid-cols-[150px_220px_220px_1fr] md:items-center"
              >
                <div className="space-y-1">
                  <Label>Pilihan {row.choice_order}</Label>
                  <Select value={row.day || EMPTY_DAY_VALUE} onValueChange={(v) => setTimeChoiceDay(row.choice_order, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih hari">
                        {row.day ? DAY_LABELS[row.day] ?? row.day : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value={EMPTY_DAY_VALUE}>(Kosong)</SelectItem>
                      {DAYS.map(([day, label]) => (
                        <SelectItem key={`choice-day-${row.choice_order}-${day}`} value={day}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Pilih Start Timeslot</Label>
                  <Select value={row.start_time_slot_id} onValueChange={(v) => setTimeChoiceStartSlot(row.choice_order, v)}>
                    <SelectTrigger disabled={!row.day}>
                      <SelectValue placeholder={row.day ? "Pilih start timeslot" : "Pilih hari dulu"}>
                        {selectedStart ? slotRangeLabel(selectedStart) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value={EMPTY_SLOT_VALUE}>(Kosong)</SelectItem>
                      {rowSlots.map((slot) => {
                        const slotId = String(slot.id);
                        const selectedElsewhere = selectedTimeSlotIds.has(slotId) && slotId !== row.start_time_slot_id && slotId !== row.end_time_slot_id;
                        return (
                          <SelectItem
                            key={`choice-start-slot-${row.choice_order}-${slot.id}`}
                            value={slotId}
                            disabled={selectedElsewhere}
                          >
                            {slotRangeLabel(slot)}
                          </SelectItem>
                        );
                      })}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Pilih End Timeslot</Label>
                  <Select value={row.end_time_slot_id} onValueChange={(v) => setTimeChoiceEndSlot(row.choice_order, v)}>
                    <SelectTrigger disabled={!row.day || !row.start_time_slot_id}>
                      <SelectValue placeholder={row.start_time_slot_id ? "Pilih end timeslot" : "Pilih start dulu"}>
                        {selectedEnd ? slotRangeLabel(selectedEnd) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value={EMPTY_SLOT_VALUE}>(Kosong)</SelectItem>
                      {endOptions.map((slot) => {
                        const slotId = String(slot.id);
                        const selectedElsewhere = selectedTimeSlotIds.has(slotId) && slotId !== row.start_time_slot_id && slotId !== row.end_time_slot_id;
                        return (
                          <SelectItem
                            key={`choice-end-slot-${row.choice_order}-${slot.id}`}
                            value={slotId}
                            disabled={selectedElsewhere}
                          >
                            {slotRangeLabel(slot)}
                          </SelectItem>
                        );
                      })}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="text-sm text-muted-foreground">
                  {selectedStart && selectedEnd
                    ? `${slotRangeLabel(selectedStart).split("-")[0]} - ${slotRangeLabel(selectedEnd).split("-")[1]}`
                    : "Belum dipilih"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
