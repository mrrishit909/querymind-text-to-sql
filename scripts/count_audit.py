import re, sys
from pathlib import Path
from collections import Counter

path = Path(sys.argv[1])
lines = [l for l in path.read_text().splitlines() if l.startswith("| PRD-")]
c = Counter()
for l in lines:
    clean = l.replace("*", "")
    m = re.search(r"\b(PASS|FAIL|PARTIAL|BLOCKED)\b", clean)
    c[m.group(1) if m else "UNLABELED"] += 1

total = len(lines)
print(f"Total requirement rows: {total}")
for k in ["PASS", "PARTIAL", "FAIL", "BLOCKED", "UNLABELED"]:
    if c.get(k):
        print(f"  {k}: {c[k]}")
