"""Copies the REAL sql_validator.py (and the reconstructed pre-fix historical
version) into site/public/validator/ for the browser build to fetch and
execute verbatim inside Pyodide, and writes validator_meta.json with a SHA-256
of each file so the site can prove on-screen that what ran in the browser is
byte-identical to what runs in production - never re-copy these by hand."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "site" / "public" / "validator"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    files = {
        "sql_validator.py": ROOT / "sql_validator.py",
        "sql_validator_prefix_historical.py": ROOT / "sql_validator_prefix_historical.py",
    }
    meta = {}
    for name, src in files.items():
        dst = DEST / name
        shutil.copyfile(src, dst)
        meta[name] = {"sha256": sha256(src), "bytes": src.stat().st_size}
        print(f"{name}: sha256={meta[name]['sha256'][:12]}... ({meta[name]['bytes']} bytes)")

    assert sha256(ROOT / "sql_validator.py") == sha256(DEST / "sql_validator.py"), "copy was not byte-identical"
    (DEST / "validator_meta.json").write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
