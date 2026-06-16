const DAY_LABELS = {
  MON: "Senin",
  TUE: "Selasa",
  WED: "Rabu",
  THU: "Kamis",
  FRI: "Jumat",
  SAT: "Sabtu",
  SUN: "Minggu",
};

const BASE_WEIGHTS = [
  { key: "c1", code: "C1", name: "Preferensi Waktu", weight: 0.32 },
  { key: "c2", code: "C2", name: "Preferensi MK", weight: 0.24 },
  { key: "c3", code: "C3", name: "Idle Gap", weight: 0.14 },
  { key: "c4", code: "C4", name: "Beban Harian", weight: 0.12 },
  { key: "c5", code: "C5", name: "Mobilitas", weight: 0.1 },
  { key: "c6", code: "C6", name: "Konsistensi Ruang", weight: 0.08 },
];

const BASE_CONSTRAINTS = [
  { key: "c1", criterion: "C1", label: "Pref. Waktu", satisfied: 20, violated: 4, total_penalty: 6.2 },
  { key: "c2", criterion: "C2", label: "Pref. MK", satisfied: 22, violated: 2, total_penalty: 3.1 },
  { key: "c3", criterion: "C3", label: "Idle Gap", satisfied: 18, violated: 6, total_penalty: 8.4 },
  { key: "c4", criterion: "C4", label: "Beban", satisfied: 21, violated: 3, total_penalty: 4.0 },
  { key: "c5", criterion: "C5", label: "Mobilitas", satisfied: 19, violated: 5, total_penalty: 5.5 },
  { key: "c6", criterion: "C6", label: "Ruangan", satisfied: 23, violated: 1, total_penalty: 1.2 },
];

function scaleCount(base, factor, min = 1) {
  return Math.max(min, Math.round(base * factor));
}

/**
 * Mock analitik timetable untuk satu dataset.
 * Nantinya diganti dari API run terakhir dataset tersebut.
 */
export function buildDatasetTimetableAnalytics(dataset, tree) {
  const datasetCode = dataset?.code ?? "DS001";
  const classCount = tree?.classes?.length ?? 4;
  const lecturerCount = tree?.lecturers?.length ?? 5;
  const courseCount = tree?.courses?.length ?? 8;
  const slotCount = tree?.time_slots?.length ?? 10;
  const roomCount = tree?.rooms?.length ?? 6;

  const scale = Math.min(1.4, Math.max(0.6, classCount / 6));
  const assignmentCount = scaleCount(classCount * 2, scale, 4);
  const fulfillmentPercent = Math.min(
    98,
    Math.round((assignmentCount / Math.max(classCount * 2, 1)) * 100),
  );

  const lecturers = (tree?.lecturers ?? []).slice(0, 5);
  const lecturerSessions = (lecturers.length > 0
    ? lecturers
    : [
        { code: `${datasetCode}-EMP001`, name: "Dr. Budi Santoso" },
        { code: `${datasetCode}-EMP002`, name: "Dr. Citra Wulandari" },
        { code: `${datasetCode}-EMP003`, name: "Prof. Dimas Pratama" },
      ]
  ).map((lecturer, index) => ({
    lecturer: lecturer.name?.split(" ").slice(0, 2).join(" ") ?? lecturer.code,
    code: lecturer.code,
    sessions: scaleCount(
      Math.ceil(assignmentCount / Math.max(lecturers.length || 3, 1)),
      1,
      1,
    ) + (index % 2),
  }));

  const assignmentsByDay = ["MON", "TUE", "WED", "THU", "FRI"].map((day, index) => {
    const sessions = scaleCount(
      Math.ceil(assignmentCount / 5) + (index % 2),
      1,
      1,
    );
    return {
      day,
      label: DAY_LABELS[day],
      sessions,
    };
  });

  const pieByDay = assignmentsByDay.map((row) => ({
    day: row.day.toLowerCase(),
    label: row.label,
    sessions: row.sessions,
    fill: `var(--color-${row.day.toLowerCase()})`,
  }));

  const constraintSummaries = BASE_CONSTRAINTS.map((row) => ({
    ...row,
    satisfied: scaleCount(row.satisfied, scale),
    violated: scaleCount(row.violated, scale, 0),
    total_penalty: Number((row.total_penalty * scale).toFixed(1)),
  }));

  const weights = BASE_WEIGHTS.map((row) => ({
    criterion: row.code,
    label: row.name,
    weight: row.weight,
  }));

  const penaltyByCriterion = constraintSummaries.map((row) => ({
    criterion: row.criterion,
    label: row.label,
    penalty: row.total_penalty,
  }));

  const radarScores = constraintSummaries.map((row) => {
    const total = row.satisfied + row.violated;
    const score = total ? Math.round((row.satisfied / total) * 100) : 0;
    return {
      subject: row.label,
      score,
      fullMark: 100,
    };
  });

  const runHistory = [1, 2, 3, 4, 5].map((runNo) => ({
    run: `Run ${runNo}`,
    objective: Number((48 - runNo * 1.15 + classCount * 0.05).toFixed(2)),
    penalty: Number((32 - runNo * 2.4 + courseCount * 0.1).toFixed(1)),
  }));

  const lecturerPenalties = lecturerSessions.slice(0, 4).map((row, index) => ({
    lecturer: row.lecturer,
    idle_gap: Number((2.1 - index * 0.3).toFixed(1)),
    mobility: Number((1.4 + index * 0.15).toFixed(1)),
    daily_load: Number((0.8 + (index % 2) * 0.3).toFixed(1)),
    balance: Number((0.5 - index * 0.08).toFixed(1)),
  }));

  return {
    run: {
      id: 1,
      dataset_id: dataset?.id,
      dataset_code: datasetCode,
      dataset_name: dataset?.name ?? "Dataset",
      status: "COMPLETED",
      objective_value: runHistory[runHistory.length - 1].objective,
      solver_name: "PULP_CBC",
      assignment_count: assignmentCount,
      lecturer_count: lecturerCount,
      course_count: courseCount,
      class_count: classCount,
      slot_count: slotCount,
      room_count: roomCount,
      fulfillment_percent: fulfillmentPercent,
      completed_at: "2026-06-15T10:32:00+07:00",
    },
    weights,
    constraintSummaries,
    penaltyByCriterion,
    assignmentsByDay,
    pieByDay,
    lecturerSessions,
    lecturerPenalties,
    radarScores,
    runHistory,
  };
}
