"""
seed_user_dataset.py
--------------------
Seed a user and one dataset into the database.

Usage:
    python -m seeds.seed_user_dataset
    python -m seeds.seed_user_dataset --email admin@example.com --password Admin123! --name Admin --dataset "Dataset Seed Default"

Run from backend directory with venv activated:
    cd backend
    .\\venv\\Scripts\\activate
    python -m seeds.seed_user_dataset
"""

from __future__ import annotations

import argparse
import sys

from app.auth import hash_password
from app.database import SessionLocal
from app.models import Dataset, User, UserRoleEnum


def _dataset_code_from_id(dataset_id: int) -> str:
    return f"DS{dataset_id:03d}"


def ensure_user_dataset(
    db,
    *,
    email: str,
    password: str,
    name: str,
    dataset_name: str,
    dataset_description: str,
) -> tuple[User, Dataset]:
    """Get or create one active user+dataset pair used by seed scripts."""
    user = db.query(User).filter(User.email == email).first()
    if user:
        if user.role != UserRoleEnum.ADMIN.value:
            user.role = UserRoleEnum.ADMIN.value
        print(f"Found existing user: id={user.id}, email={user.email}")
    else:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role=UserRoleEnum.ADMIN.value,
            created_by=1,
        )
        db.add(user)
        db.flush()
        print(f"Created user: id={user.id}, email={user.email}")

    dataset = (
        db.query(Dataset)
        .filter(
            Dataset.user_id == user.id,
            Dataset.name == dataset_name,
        )
        .first()
    )
    if dataset:
        if not dataset.code:
            dataset.code = _dataset_code_from_id(dataset.id)
        print(f"Found existing dataset: id={dataset.id}, name={dataset.name}")
    else:
        dataset = Dataset(
            user_id=user.id,
            created_by=1,
            code="TMP",
            name=dataset_name,
            description=dataset_description,
        )
        db.add(dataset)
        db.flush()
        dataset.code = _dataset_code_from_id(dataset.id)
        print(f"Created dataset: id={dataset.id}, name={dataset.name}")

    return user, dataset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed one user and one dataset.")
    parser.add_argument("--email", default="admin@example.com", help="User email")
    parser.add_argument("--password", default="Admin123!", help="User password (plain text)")
    parser.add_argument("--name", default="Admin", help="User display name")
    parser.add_argument("--dataset", default="Dataset Seed Default", help="Dataset name")
    parser.add_argument(
        "--dataset-description",
        default="Auto-created for seed scripts",
        help="Dataset description",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    db = SessionLocal()
    try:
        user, dataset = ensure_user_dataset(
            db,
            email=args.email,
            password=args.password,
            name=args.name,
            dataset_name=args.dataset,
            dataset_description=args.dataset_description,
        )

        db.commit()

        print("\nSeed user + dataset selesai.")
        print(f"USER_ID={user.id}")
        print(f"DATASET_ID={dataset.id}")
    except Exception as exc:
        db.rollback()
        print(f"Seed gagal: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
