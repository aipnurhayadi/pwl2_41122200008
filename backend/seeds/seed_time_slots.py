"""
seed_time_slots.py
------------------
Seed time slots (07:00-23:00, 40-min each, break 11:40-13:00) for every day
of the week into an auto-managed dataset.

Usage:
    python -m seeds.seed_time_slots
    python -m seeds.seed_time_slots --overwrite

Run from the backend directory with the venv activated:
    cd backend
    .\\venv\\Scripts\\activate
    python -m seeds.seed_time_slots
"""

import argparse
from datetime import time, timedelta, datetime

from seeds.seed_user_dataset import ensure_user_dataset

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed weekly time slots into an auto-managed dataset."
    )
    parser.add_argument("--overwrite", action="store_true", help="Delete existing active rows before insert")
    parser.add_argument("--email", default="admin@example.com", help="Seed user email")
    parser.add_argument("--password", default="Admin123!", help="Seed user password")
    parser.add_argument("--name", default="Admin", help="Seed user name")
    parser.add_argument("--dataset", default="Dataset Seed Default", help="Seed dataset name")
    parser.add_argument(
        "--dataset-description",
        default="Auto-created for seed scripts",
        help="Seed dataset description",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# DB seeding
# ---------------------------------------------------------------------------
def main():
    args = parse_args()
    slots = build_slots()

    print(f"Slots per day: {len(slots)}")
    for s, e in slots:
        print(f"  {s.strftime('%H:%M')} - {e.strftime('%H:%M')}")
    print(f"\nTotal rows to insert: {len(slots)} slots × {len(DAYS)} days = {len(slots) * len(DAYS)}")
    print()

    from app.database import SessionLocal
    from app.models import TimeSlot, DayEnum

    db = SessionLocal()
    try:
        _, dataset = ensure_user_dataset(
            db,
            email=args.email,
            password=args.password,
            name=args.name,
            dataset_name=args.dataset,
            dataset_description=args.dataset_description,
        )
        dataset_id = dataset.id
        print(f"Seeding into dataset: [{dataset.id}] {dataset.name}")

        # Remove existing (non-deleted) time slots for this dataset first
        existing = (
            db.query(TimeSlot)
            .filter(TimeSlot.dataset_id == dataset_id, TimeSlot.deleted_at.is_(None))
            .count()
        )
        if existing and not args.overwrite:
            print(
                f"Skip time slots: dataset already has {existing} active row(s). "
                "Gunakan --overwrite untuk replace data."
            )
            db.commit()
            return

        if existing and args.overwrite:
            db.query(TimeSlot).filter(
                TimeSlot.dataset_id == dataset_id,
                TimeSlot.deleted_at.is_(None),
            ).delete(synchronize_session=False)
            db.flush()
            print(f"Deleted {existing} existing time slots.")

        rows = []
        seq = 1
        for day in DAYS:
            for start, end in slots:
                rows.append(
                    TimeSlot(
                        dataset_id=dataset_id,
                        code=f"TS{seq:03d}",
                        day=DayEnum(day),
                        start_time=start,
                        end_time=end,
                    )
                )
                seq += 1

        db.bulk_save_objects(rows)
        db.commit()
        print(f"Done. Inserted {len(rows)} time slots.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
