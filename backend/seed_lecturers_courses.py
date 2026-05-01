"""
seed_lecturers_courses.py
--------------------------
Seed lecturers and courses (master data only, no relations) into a dataset.

Usage:
    python seed_lecturers_courses.py <dataset_id>

Run from backend directory with venv activated:
    cd backend
    .\\venv\\Scripts\\activate
    python seed_lecturers_courses.py 2
"""

import sys

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

def _lect_code(n: int) -> str:
    return f"DSN{n:03d}"


def _course_code(n: int) -> str:
    return f"MK{n:03d}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: python seed_lecturers_courses.py <dataset_id>")
        sys.exit(1)

    dataset_id = int(sys.argv[1])

    from app.database import SessionLocal
    from app.models import Lecturer, Course, Dataset

    db = SessionLocal()
    try:
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id, Dataset.deleted_at.is_(None)
        ).first()
        if not dataset:
            print(f"ERROR: Dataset id={dataset_id} not found.")
            sys.exit(1)

        print(f"Seeding into dataset: [{dataset.id}] {dataset.name}")
        print()

        # ---- Lecturers ----
        existing_lect = (
            db.query(Lecturer)
            .filter(Lecturer.dataset_id == dataset_id, Lecturer.deleted_at.is_(None))
            .count()
        )
        if existing_lect:
            confirm = input(
                f"Dataset already has {existing_lect} active lecturer(s). "
                "Skip existing / overwrite all? [skip/overwrite/abort] "
            ).strip().lower()
            if confirm == "abort":
                print("Aborted.")
                sys.exit(0)
            overwrite_lect = confirm == "overwrite"
            if overwrite_lect:
                db.query(Lecturer).filter(
                    Lecturer.dataset_id == dataset_id,
                    Lecturer.deleted_at.is_(None),
                ).delete(synchronize_session=False)
                db.flush()
                print(f"Deleted {existing_lect} existing lecturers.")
        else:
            overwrite_lect = False

        # Count ALL (inc. soft-deleted) for code sequence
        base_lect = db.query(Lecturer).filter(Lecturer.dataset_id == dataset_id).count()
        lect_rows = []
        for i, (name, front_title, back_title) in enumerate(LECTURERS):
            code = _lect_code(base_lect + i + 1)
            lect_rows.append(
                Lecturer(
                    dataset_id=dataset_id,
                    name=name,
                    code=code,
                    front_title=front_title,
                    back_title=back_title,
                )
            )
        db.bulk_save_objects(lect_rows)
        db.flush()
        print(f"Inserted {len(lect_rows)} lecturers:")
        for l in lect_rows:
            full = " ".join(filter(None, [l.front_title, l.name, l.back_title]))
            print(f"  [{l.code}] {full}")

        print()

        # ---- Courses ----
        existing_course = (
            db.query(Course)
            .filter(Course.dataset_id == dataset_id, Course.deleted_at.is_(None))
            .count()
        )
        if existing_course:
            confirm = input(
                f"Dataset already has {existing_course} active course(s). "
                "Skip existing / overwrite all? [skip/overwrite/abort] "
            ).strip().lower()
            if confirm == "abort":
                print("Aborted.")
                db.rollback()
                sys.exit(0)
            overwrite_course = confirm == "overwrite"
            if overwrite_course:
                db.query(Course).filter(
                    Course.dataset_id == dataset_id,
                    Course.deleted_at.is_(None),
                ).delete(synchronize_session=False)
                db.flush()
                print(f"Deleted {existing_course} existing courses.")
        else:
            overwrite_course = False

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
