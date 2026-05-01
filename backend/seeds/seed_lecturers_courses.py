"""
seed_lecturers_courses.py
--------------------------
Seed lecturers and courses (master data only, no relations) into a dataset.

Usage:
    python -m seeds.seed_lecturers_courses
    python -m seeds.seed_lecturers_courses --overwrite

Run from backend directory with venv activated:
    cd backend
    .\\venv\\Scripts\\activate
    python -m seeds.seed_lecturers_courses
"""

import argparse

from app import auth
from seeds.seed_user_dataset import ensure_user_dataset

# ---------------------------------------------------------------------------
# Data to seed
# [e] = elective, noted in description
# ---------------------------------------------------------------------------

LECTURERS = [
    # (name, front_title, back_title)
    ("Helmy Faisal Muttaqin",         None,  "S.Kom., M.T."),
    ("R.A.E. Virgana Targa Sapanji",  "Dr.", "S.Kom., M.T."),
    ("Dani Hamdani",                  None,  "S.Kom., M.T."),
    ("Iwan Rijayana",                 None,  "S.Kom., M.M., M.Kom."),
    ("Rosalin Samihardjo",            None,  "S.T., M.Kom., MCE."),
]

COURSES = [
    # (name, credits, description)
    ("Digital Forensic",                 3, None),
    ("Pemrograman For Data Science",     3, None),
    ("Interaksi Manusia dan Komputer",   3, "Mata kuliah pilihan (elective)"),
    ("Pemrograman Web Lanjut",           3, None),
    ("Manajemen Kualitas",               3, "Mata kuliah pilihan (elective)"),
    ("Kecakapan Interpersonal",          3, "Mata kuliah pilihan (elective)"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _employee_code(n: int) -> str:
    return f"EMP{n:03d}"


def _course_code(n: int) -> str:
    return f"MK{n:03d}"


def _unique_user_email(db, preferred: str | None, employee_code: str) -> str:
    from app.models import User

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
    while db.query(User.id).filter(User.email == candidate).first():
        candidate = f"{local}{suffix}@{domain}"
        suffix += 1

    return candidate


def _ensure_employee_user(db, employee, default_password: str) -> None:
    from app.models import User, UserRoleEnum

    if employee.user_id:
        return

    user = User(
        name=employee.name,
        email=_unique_user_email(db, employee.email, employee.employee_code),
        password_hash=auth.hash_password(default_password),
        role=UserRoleEnum.LECTURER.value,
    )
    db.add(user)
    db.flush()
    employee.user_id = user.id
    db.flush()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed lecturers and courses into an auto-managed dataset."
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
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()
    default_employee_password = "Employee123!"

    from app.database import SessionLocal
    from app.models import Lecturer, Course, Employee

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
        print()

        # ---- Employees + Lecturer Assignments ----
        existing_lect = (
            db.query(Lecturer)
            .filter(Lecturer.dataset_id == dataset_id, Lecturer.deleted_at.is_(None))
            .count()
        )
        if existing_lect and not args.overwrite:
            print(
                f"Skip lecturers: dataset already has {existing_lect} active lecturer assignment(s). "
                "Gunakan --overwrite untuk replace data."
            )
        else:
            if existing_lect and args.overwrite:
                db.query(Lecturer).filter(
                    Lecturer.dataset_id == dataset_id,
                    Lecturer.deleted_at.is_(None),
                ).delete(synchronize_session=False)
                db.flush()
                print(f"Deleted {existing_lect} existing lecturer assignments.")

            created_assignments = []
            for name, front_title, back_title in LECTURERS:
                employee = (
                    db.query(Employee)
                    .filter(Employee.name == name)
                    .first()
                )
                if not employee:
                    next_seq = db.query(Employee).count() + 1
                    employee_code = _employee_code(next_seq)
                    user_email = _unique_user_email(db, None, employee_code)
                    from app.models import User, UserRoleEnum

                    user = User(
                        name=name,
                        email=user_email,
                        password_hash=auth.hash_password(default_employee_password),
                        role=UserRoleEnum.LECTURER.value,
                    )
                    db.add(user)
                    db.flush()

                    employee = Employee(
                        user_id=user.id,
                        employee_code=employee_code,
                        name=name,
                        front_title=front_title,
                        back_title=back_title,
                    )
                    db.add(employee)
                    db.flush()
                else:
                    _ensure_employee_user(db, employee, default_employee_password)

                exists_assignment = (
                    db.query(Lecturer)
                    .filter(
                        Lecturer.dataset_id == dataset_id,
                        Lecturer.employee_id == employee.id,
                        Lecturer.deleted_at.is_(None),
                    )
                    .first()
                )
                if exists_assignment:
                    continue

                assignment = Lecturer(
                    dataset_id=dataset_id,
                    employee_id=employee.id,
                    code=f"{dataset.code}-{employee.employee_code}",
                )
                db.add(assignment)
                db.flush()
                created_assignments.append(assignment)

            print(f"Inserted {len(created_assignments)} lecturer assignments:")
            for a in created_assignments:
                emp = a.employee
                full = " ".join(filter(None, [emp.front_title, emp.name, emp.back_title]))
                print(f"  [{a.code}] {full}")

        print()

        # ---- Courses ----
        existing_course = (
            db.query(Course)
            .filter(Course.dataset_id == dataset_id, Course.deleted_at.is_(None))
            .count()
        )
        if existing_course and not args.overwrite:
            print(
                f"Skip courses: dataset already has {existing_course} active course(s). "
                "Gunakan --overwrite untuk replace data."
            )
        else:
            if existing_course and args.overwrite:
                db.query(Course).filter(
                    Course.dataset_id == dataset_id,
                    Course.deleted_at.is_(None),
                ).delete(synchronize_session=False)
                db.flush()
                print(f"Deleted {existing_course} existing courses.")

            base_course = db.query(Course).filter(Course.dataset_id == dataset_id).count()
            course_rows = []
            for i, (name, credits, description) in enumerate(COURSES):
                code = _course_code(base_course + i + 1)
                course_rows.append(
                    Course(
                        dataset_id=dataset_id,
                        name=name,
                        code=code,
                        credits=credits,
                        description=description,
                    )
                )
            db.bulk_save_objects(course_rows)
            db.flush()
            print(f"Inserted {len(course_rows)} courses:")
            for c in course_rows:
                print(f"  [{c.code}] {c.name}" + (" (elective)" if c.description else ""))

        db.commit()
        print("\nDone.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
