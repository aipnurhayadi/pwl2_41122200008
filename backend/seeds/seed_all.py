"""Seed all core data with deterministic overwrite behavior.

Usage:
    python -m seeds.seed_all
    python -m seeds.seed_all --overwrite
"""

from __future__ import annotations

import argparse
from datetime import datetime, time, timedelta

from app import auth, models
from app.database import SessionLocal

SYSTEM_USER_ID = 1
DEFAULT_EMPLOYEE_PASSWORD = "Employee123!"

LECTURERS = [
    ("Helmy Faisal Muttaqin", None, "S.Kom., M.T."),
    ("R.A.E. Virgana Targa Sapanji", "Dr.", "S.Kom., M.T."),
    ("Dani Hamdani", None, "S.Kom., M.T."),
    ("Iwan Rijayana", None, "S.Kom., M.M., M.Kom."),
    ("Rosalin Samihardjo", None, "S.T., M.Kom., MCE."),
]

COURSES = [
    ("Digital Forensic", 3, None),
    ("Pemrograman For Data Science", 3, None),
    ("Interaksi Manusia dan Komputer", 3, "Mata kuliah pilihan (elective)"),
    ("Pemrograman Web Lanjut", 3, None),
    ("Manajemen Kualitas", 3, "Mata kuliah pilihan (elective)"),
    ("Kecakapan Interpersonal", 3, "Mata kuliah pilihan (elective)"),
]

BREAK_START = time(11, 40)
BREAK_END = time(13, 0)
SLOT_MINUTES = 40
DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed all core data in one command")
    parser.add_argument("--overwrite", action="store_true", help="Hard reset dataset resources before seed")
    parser.add_argument("--email", default="admin@example.com", help="Admin user email")
    parser.add_argument("--password", default="Admin123!", help="Admin user password")
    parser.add_argument("--name", default="Admin", help="Admin user name")
    parser.add_argument("--dataset", default="Dataset Seed Default", help="Dataset name")
    parser.add_argument("--dataset-description", default="Auto-created for seed scripts", help="Dataset description")
    return parser.parse_args()


def _dataset_code_from_id(dataset_id: int) -> str:
    return f"DS{dataset_id:03d}"


def _employee_code(n: int) -> str:
    return f"EMP{n:03d}"


def _unique_user_email(db, preferred: str | None, employee_code: str) -> str:
    base = (preferred or "").strip().lower()
    if not base:
        base = f"{employee_code.lower()}@example.com"

    if "@" not in base:
        base = f"{base}@example.com"

    local, domain = base.split("@", 1)
    if not local:
        local = employee_code.lower()
    if not domain:
        domain = "example.com"

    candidate = f"{local}@{domain}"
    suffix = 1
    while db.query(models.User.id).filter(models.User.email == candidate).first():
        candidate = f"{local}{suffix}@{domain}"
        suffix += 1
    return candidate


def _build_slots() -> list[tuple[time, time]]:
    slots = []
    dt = datetime(2000, 1, 1, 7, 0)
    end_dt = datetime(2000, 1, 1, 23, 0)
    delta = timedelta(minutes=SLOT_MINUTES)

    while dt < end_dt:
        t_start = dt.time()
        t_end = (dt + delta).time()
        if BREAK_START <= t_start < BREAK_END:
            dt = datetime(2000, 1, 1, BREAK_END.hour, BREAK_END.minute)
            continue
        slots.append((t_start, t_end))
        dt += delta

    return slots


def _ensure_system_user(db) -> None:
    user = db.query(models.User).filter(models.User.id == SYSTEM_USER_ID).first()
    if user:
        return

    db.add(
        models.User(
            id=SYSTEM_USER_ID,
            name="SYSTEM",
            email="system@local",
            password_hash="SYSTEM",
            role=models.UserRoleEnum.ADMIN.value,
            created_by=SYSTEM_USER_ID,
        )
    )
    db.flush()


def _ensure_admin_user_dataset(db, *, email: str, password: str, name: str, dataset_name: str, dataset_description: str):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            name=name,
            email=email,
            password_hash=auth.hash_password(password),
            role=models.UserRoleEnum.ADMIN.value,
            created_by=SYSTEM_USER_ID,
        )
        db.add(user)
        db.flush()
        print(f"Created admin user: id={user.id}, email={user.email}")
    else:
        if user.role != models.UserRoleEnum.ADMIN.value:
            user.role = models.UserRoleEnum.ADMIN.value
        print(f"Found admin user: id={user.id}, email={user.email}")

    dataset = (
        db.query(models.Dataset)
        .filter(models.Dataset.user_id == user.id, models.Dataset.name == dataset_name)
        .first()
    )
    if not dataset:
        dataset = models.Dataset(
            user_id=user.id,
            created_by=user.id,
            code="TMP",
            name=dataset_name,
            description=dataset_description,
        )
        db.add(dataset)
        db.flush()
        dataset.code = _dataset_code_from_id(dataset.id)
        print(f"Created dataset: id={dataset.id}, name={dataset.name}")
    else:
        if not dataset.code:
            dataset.code = _dataset_code_from_id(dataset.id)
        print(f"Found dataset: id={dataset.id}, name={dataset.name}")

    return user, dataset


def _hard_reset_dataset_resources(db, dataset_id: int) -> None:
    db.query(models.BwmResponse).filter(models.BwmResponse.dataset_id == dataset_id).delete(synchronize_session=False)
    db.query(models.Class).filter(models.Class.dataset_id == dataset_id).delete(synchronize_session=False)
    db.query(models.TimeSlot).filter(models.TimeSlot.dataset_id == dataset_id).delete(synchronize_session=False)
    db.query(models.Course).filter(models.Course.dataset_id == dataset_id).delete(synchronize_session=False)
    db.query(models.Lecturer).filter(models.Lecturer.dataset_id == dataset_id).delete(synchronize_session=False)
    db.query(models.Room).filter(models.Room.dataset_id == dataset_id).delete(synchronize_session=False)


def _next_employee_seq(db) -> int:
    return db.query(models.Employee).count() + 1


def _ensure_employee_with_user(db, *, name: str, front_title: str | None, back_title: str | None, creator_id: int) -> models.Employee:
    employee = db.query(models.Employee).filter(models.Employee.name == name).first()
    if employee:
        employee.front_title = front_title
        employee.back_title = back_title
        if not employee.user_id:
            candidate_code = employee.employee_code or _employee_code(_next_employee_seq(db))
            email = _unique_user_email(db, None, candidate_code)
            user = models.User(
                name=name,
                email=email,
                password_hash=auth.hash_password(DEFAULT_EMPLOYEE_PASSWORD),
                role=models.UserRoleEnum.LECTURER.value,
                created_by=creator_id,
            )
            db.add(user)
            db.flush()
            employee.user_id = user.id
        return employee

    employee_code = _employee_code(_next_employee_seq(db))
    email = _unique_user_email(db, None, employee_code)
    user = models.User(
        name=name,
        email=email,
        password_hash=auth.hash_password(DEFAULT_EMPLOYEE_PASSWORD),
        role=models.UserRoleEnum.LECTURER.value,
        created_by=creator_id,
    )
    db.add(user)
    db.flush()

    employee = models.Employee(
        user_id=user.id,
        created_by=creator_id,
        employee_code=employee_code,
        name=name,
        front_title=front_title,
        back_title=back_title,
    )
    db.add(employee)
    db.flush()
    return employee


def _seed_lecturers_and_courses(db, dataset: models.Dataset, creator_id: int) -> None:
    created_lecturers = []
    for name, front_title, back_title in LECTURERS:
        employee = _ensure_employee_with_user(
            db,
            name=name,
            front_title=front_title,
            back_title=back_title,
            creator_id=creator_id,
        )
        lecturer = models.Lecturer(
            dataset_id=dataset.id,
            created_by=creator_id,
            employee_id=employee.id,
            code=f"{dataset.code}-{employee.employee_code}",
        )
        db.add(lecturer)
        created_lecturers.append(lecturer)

    print(f"Inserted {len(created_lecturers)} lecturer assignments.")

    created_courses = []
    for i, (name, credits, description) in enumerate(COURSES, start=1):
        course = models.Course(
            dataset_id=dataset.id,
            created_by=creator_id,
            name=name,
            code=f"MK{i:03d}",
            credits=credits,
            description=description,
        )
        db.add(course)
        created_courses.append(course)

    print(f"Inserted {len(created_courses)} courses.")


def _seed_time_slots(db, dataset: models.Dataset, creator_id: int) -> None:
    slots = _build_slots()
    seq = 1
    for day in DAYS:
        for start, end in slots:
            db.add(
                models.TimeSlot(
                    dataset_id=dataset.id,
                    created_by=creator_id,
                    code=f"TS{seq:03d}",
                    day=models.DayEnum(day),
                    start_time=start,
                    end_time=end,
                )
            )
            seq += 1
    print(f"Inserted {len(slots) * len(DAYS)} time slots.")


def main() -> None:
    args = parse_args()
    db = SessionLocal()

    try:
        _ensure_system_user(db)
        user, dataset = _ensure_admin_user_dataset(
            db,
            email=args.email,
            password=args.password,
            name=args.name,
            dataset_name=args.dataset,
            dataset_description=args.dataset_description,
        )

        if args.overwrite:
            _hard_reset_dataset_resources(db, dataset.id)
            print(f"Overwrite enabled: cleared existing resources for dataset id={dataset.id}.")

        has_lecturers = db.query(models.Lecturer).filter(models.Lecturer.dataset_id == dataset.id).count() > 0
        has_courses = db.query(models.Course).filter(models.Course.dataset_id == dataset.id).count() > 0
        has_timeslots = db.query(models.TimeSlot).filter(models.TimeSlot.dataset_id == dataset.id).count() > 0

        if has_lecturers or has_courses or has_timeslots:
            print("Seed skipped because dataset already has data. Use --overwrite to reset and reseed.")
            db.commit()
            return

        _seed_lecturers_and_courses(db, dataset, user.id)
        _seed_time_slots(db, dataset, user.id)
        db.commit()

        print("\nSeed selesai.")
        print(f"USER_ID={user.id}")
        print(f"DATASET_ID={dataset.id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
