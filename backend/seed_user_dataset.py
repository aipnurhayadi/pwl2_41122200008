"""
seed_user_dataset.py
--------------------
Seed a user and one dataset into the database.

Usage:
    python seed_user_dataset.py
    python seed_user_dataset.py --email admin@example.com --password Admin123! --name Admin --dataset "Dataset Seed Default"

Run from backend directory with venv activated:
    cd backend
    .\\venv\\Scripts\\activate
    python seed_user_dataset.py
"""

from __future__ import annotations

import argparse
import sys

from app.auth import hash_password
from app.database import SessionLocal
from app.models import Dataset, User


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
        user = db.query(User).filter(User.email == args.email).first()
        if user:
            print(f"Found existing user: id={user.id}, email={user.email}")
        else:
            user = User(
                name=args.name,
                email=args.email,
                password_hash=hash_password(args.password),
            )
            db.add(user)
            db.flush()
            print(f"Created user: id={user.id}, email={user.email}")

        dataset = (
            db.query(Dataset)
            .filter(
                Dataset.user_id == user.id,
                Dataset.name == args.dataset,
                Dataset.deleted_at.is_(None),
            )
            .first()
        )
        if dataset:
            print(f"Found existing dataset: id={dataset.id}, name={dataset.name}")
        else:
            dataset = Dataset(
                user_id=user.id,
                name=args.dataset,
                description=args.dataset_description,
            )
            db.add(dataset)
            db.flush()
            print(f"Created dataset: id={dataset.id}, name={dataset.name}")

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
