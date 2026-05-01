"""
seed_time_slots.py
------------------
Seed time slots (07:00-23:00, 40-min each, break 11:40-13:00) for every day
of the week into a specified dataset.

Usage:
    python seed_time_slots.py <dataset_id>

Run from the backend directory with the venv activated:
    cd backend
    .\\venv\\Scripts\\activate
    python seed_time_slots.py 1
"""

import sys
from datetime import time, timedelta, datetime

# ---------------------------------------------------------------------------
# Build the slot list (start, end) pairs, skipping the break window
# ---------------------------------------------------------------------------
BREAK_START = time(11, 40)   # first slot that overlaps 12:00-13:00
BREAK_END   = time(13, 0)
SLOT_MINUTES = 40


def build_slots() -> list[tuple[time, time]]:
    """Generate 40-min slots from 07:00 to 23:00, skipping BREAK_START-BREAK_END."""
    slots = []
    dt = datetime(2000, 1, 1, 7, 0)           # anchor date doesn't matter
    end_dt = datetime(2000, 1, 1, 23, 0)
    delta = timedelta(minutes=SLOT_MINUTES)

    while dt < end_dt:
        t_start = dt.time()
        t_end   = (dt + delta).time()
        # Skip any slot that starts within the break window
        if BREAK_START <= t_start < BREAK_END:
            dt = datetime(2000, 1, 1, BREAK_END.hour, BREAK_END.minute)
            continue
        slots.append((t_start, t_end))
        dt += delta

    return slots


DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


# ---------------------------------------------------------------------------
# DB seeding
# ---------------------------------------------------------------------------
def main():
    if len(sys.argv) < 2:
        print("Usage: python seed_time_slots.py <dataset_id>")
        sys.exit(1)

    dataset_id = int(sys.argv[1])
    slots = build_slots()

    print(f"Slots per day: {len(slots)}")
    for s, e in slots:
        print(f"  {s.strftime('%H:%M')} - {e.strftime('%H:%M')}")
    print(f"\nTotal rows to insert: {len(slots)} slots × {len(DAYS)} days = {len(slots) * len(DAYS)}")
    print()

    from app.database import SessionLocal
    from app.models import TimeSlot, DayEnum, Dataset

    db = SessionLocal()
    try:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.deleted_at.is_(None)).first()
        if not dataset:
            print(f"ERROR: Dataset id={dataset_id} not found.")
            sys.exit(1)
        print(f"Seeding into dataset: [{dataset.id}] {dataset.name}")

        # Remove existing (non-deleted) time slots for this dataset first
        existing = (
            db.query(TimeSlot)
            .filter(TimeSlot.dataset_id == dataset_id, TimeSlot.deleted_at.is_(None))
            .count()
        )
        if existing:
            confirm = input(f"Dataset already has {existing} active time slot(s). Overwrite? [y/N] ").strip().lower()
            if confirm != "y":
                print("Aborted.")
                sys.exit(0)
            db.query(TimeSlot).filter(
                TimeSlot.dataset_id == dataset_id,
                TimeSlot.deleted_at.is_(None),
            ).delete(synchronize_session=False)
            db.flush()
            print(f"Deleted {existing} existing time slots.")

        rows = []
        for day in DAYS:
            for start, end in slots:
                rows.append(
                    TimeSlot(
                        dataset_id=dataset_id,
                        day=DayEnum(day),
                        start_time=start,
                        end_time=end,
                    )
                )

        db.bulk_save_objects(rows)
        db.commit()
        print(f"Done. Inserted {len(rows)} time slots.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
