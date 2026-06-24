const DAY_LABELS = {
  MON: "Senin",
  TUE: "Selasa",
  WED: "Rabu",
  THU: "Kamis",
  FRI: "Jumat",
  SAT: "Sabtu",
  SUN: "Minggu",
};

function shortName(fullName, fallback) {
  if (!fullName) return fallback;
  return fullName.split(" ").slice(0, 2).join(" ");
}

export function buildTimetableAnalyticsFromRun(
  dataset,
  tree,
  runDetail,
  runs = [],
  criteria = [],
) {
  const criteriaMap = new Map(criteria.map((row) => [row.id, row]));
  const lecturerMap = new Map((tree?.lecturers ?? []).map((row) => [row.id, row]));
  const slotMap = new Map((tree?.time_slots ?? []).map((row) => [row.id, row]));

  const resolveCriterion = (criterionId) =>
    criteriaMap.get(criterionId) ?? runDetail?.weights?.find((w) => w.criterion_id === criterionId)?.criterion;

  const weights = (runDetail?.weights ?? []).map((row) => {
    const criterion = resolveCriterion(row.criterion_id);
    return {
      criterion: criterion?.code ?? String(row.criterion_id),
      label: criterion?.name ?? `C${row.criterion_id}`,
      weight: Number(row.weight ?? 0),
    };
  });

  const constraintSummaries = (runDetail?.constraint_summaries ?? []).map((row) => {
    const criterion = resolveCriterion(row.criterion_id);
    return {
      criterion: criterion?.code ?? String(row.criterion_id),
      label: criterion?.name ?? `C${row.criterion_id}`,
      satisfied: Number(row.satisfied_count ?? 0),
      violated: Number(row.violated_count ?? 0),
      total_penalty: Number(row.total_penalty ?? 0),
    };
  });

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

  const dayCounts = {};
  for (const assignment of runDetail?.assignments ?? []) {
    const slot = slotMap.get(assignment.start_time_slot_id);
    const day = slot?.day ?? "MON";
    dayCounts[day] = (dayCounts[day] ?? 0) + 1;
  }

  const assignmentsByDay = Object.entries(dayCounts).map(([day, sessions]) => ({
    day,
    label: DAY_LABELS[day] ?? day,
    sessions,
  }));

  const pieByDay = assignmentsByDay.map((row) => ({
    day: row.day.toLowerCase(),
    label: row.label,
    sessions: row.sessions,
    fill: `var(--color-${row.day.toLowerCase()})`,
  }));

  const lecturerSessions = (runDetail?.lecturer_summaries ?? []).map((row) => {
    const lecturer = lecturerMap.get(row.lecturer_id);
    return {
      lecturer: shortName(lecturer?.name, `Dosen #${row.lecturer_id}`),
      code: lecturer?.code ?? `L${row.lecturer_id}`,
      sessions: Number(row.session_count ?? 0),
      total_penalty: Number(row.total_penalty ?? 0),
      fairness_deviation: Number(row.fairness_deviation ?? 0),
    };
  });

  const lecturerPenalties = lecturerSessions.map((row) => ({
    lecturer: row.lecturer,
    penalty: row.total_penalty,
    deviation: row.fairness_deviation,
  }));

  const assignmentCount = runDetail?.assignments?.length ?? 0;
  const classCount = tree?.classes?.length ?? 0;
  const fulfillmentPercent =
    classCount > 0
      ? Math.min(100, Math.round((assignmentCount / Math.max(classCount, 1)) * 100))
      : 0;

  const runHistory = runs
    .filter((row) => row.status === "COMPLETED")
    .slice(0, 5)
    .reverse()
    .map((row) => ({
      run: `Run ${row.id}`,
      objective: Number(row.objective_value ?? 0),
      penalty: Number(row.fairness_index ?? 0),
    }));

  return {
    run: {
      id: runDetail?.id,
      dataset_id: dataset?.id,
      dataset_code: dataset?.code,
      dataset_name: dataset?.name ?? "Dataset",
      status: runDetail?.status ?? "COMPLETED",
      objective_value: runDetail?.objective_value,
      solver_name: runDetail?.solver_name ?? "CBC",
      fairness_index: runDetail?.fairness_index,
      assignment_count: assignmentCount,
      lecturer_count: tree?.lecturers?.length ?? 0,
      course_count: tree?.courses?.length ?? 0,
      class_count: classCount,
      slot_count: tree?.time_slots?.length ?? 0,
      room_count: tree?.rooms?.length ?? 0,
      fulfillment_percent: fulfillmentPercent,
      completed_at: runDetail?.finished_at,
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
