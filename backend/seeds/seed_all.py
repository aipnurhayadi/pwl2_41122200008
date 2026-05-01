"""
seed_all.py
-----------
Run all seed scripts as one integrated flow:
1) user + dataset
2) lecturers + courses
3) time slots

Usage:
    python -m seeds.seed_all
    python -m seeds.seed_all --overwrite
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run all seed scripts in one command.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing lecturers/courses/time slots")
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


def run_step(module_name: str, base_args: list[str], overwrite: bool) -> None:
    cmd = [sys.executable, "-m", module_name, *base_args]
    if overwrite:
        cmd.append("--overwrite")

    print(f"\n=== Running: {' '.join(cmd)} ===")
    subprocess.run(cmd, check=True, cwd=Path(__file__).resolve().parent.parent)


def main() -> None:
    args = parse_args()
    shared_args = [
        "--email",
        args.email,
        "--password",
        args.password,
        "--name",
        args.name,
        "--dataset",
        args.dataset,
        "--dataset-description",
        args.dataset_description,
    ]

    run_step("seeds.seed_user_dataset", shared_args, overwrite=False)
    run_step("seeds.seed_lecturers_courses", shared_args, overwrite=args.overwrite)
    run_step("seeds.seed_time_slots", shared_args, overwrite=args.overwrite)

    print("\nSemua proses seed selesai.")


if __name__ == "__main__":
    main()
