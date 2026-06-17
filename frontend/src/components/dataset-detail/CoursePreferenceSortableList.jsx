import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

function SortableCourseRow({ id, rank, course, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-3"
    >
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
        disabled={disabled}
        aria-label={`Urutkan rank ${rank}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {rank}
      </span>
      <div className="min-w-0 grow">
        <p className="font-mono text-sm font-medium">{course?.code ?? id}</p>
        <p className="text-sm text-muted-foreground truncate">{course?.name ?? "—"}</p>
      </div>
    </div>
  );
}

export default function CoursePreferenceSortableList({
  rankedCourseIds,
  courses,
  allowedCourseIds,
  onChange,
  disabled = false,
}) {
  const courseById = useMemo(() => {
    const map = new Map();
    for (const course of courses) {
      map.set(String(course.id), course);
    }
    return map;
  }, [courses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rankedCourseIds.indexOf(String(active.id));
    const newIndex = rankedCourseIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    onChange(arrayMove(rankedCourseIds, oldIndex, newIndex));
  };

  const noAllowed = allowedCourseIds.length === 0;

  if (rankedCourseIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
        {noAllowed
          ? "Belum ada mata kuliah yang diizinkan. Hubungi admin untuk mapping MK."
          : "Belum ada mata kuliah untuk diurutkan."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rankedCourseIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rankedCourseIds.map((courseId, index) => (
              <SortableCourseRow
                key={courseId}
                id={courseId}
                rank={index + 1}
                course={courseById.get(courseId)}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p className="text-xs text-muted-foreground">
        {rankedCourseIds.length} mata kuliah · drag untuk mengubah urutan prioritas
      </p>
    </div>
  );
}
