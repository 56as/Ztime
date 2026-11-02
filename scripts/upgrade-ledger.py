"""Make a consistent private backup before replacing the local Windows client."""
from contextlib import closing
import sqlite3
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

action, directory, archive = sys.argv[1:]
data = Path(directory)
archive = Path(archive)
with tempfile.TemporaryDirectory() as tmp:
    snapshot = Path(tmp) / "ledger.sqlite"
    live = sqlite3.connect((data / "ledger.sqlite").as_uri() + "?mode=ro", uri=True)
    if action == "backup":
        with closing(sqlite3.connect(snapshot)) as dest:
            live.backup(dest)
        with ZipFile(archive, "x", ZIP_DEFLATED) as out:
            out.write(snapshot, "ledger.sqlite")
            if (data / "tls.json").exists():
                out.write(data / "tls.json", "tls.json")
    elif action == "verify":
        with ZipFile(archive) as saved:
            snapshot.write_bytes(saved.read("ledger.sqlite"))
            if "tls.json" in saved.namelist() and saved.read("tls.json") != (data / "tls.json").read_bytes():
                raise ValueError("TLS identity changed")
        live.execute("ATTACH DATABASE ? AS before", (str(snapshot),))
        tables = [("sessions", "id"), ("peers", "id, token_hash"), ("meta", "value")]
        for table in ("behavior_names", "behavior_rules", "behavior_overrides"):
            if live.execute("SELECT 1 FROM before.sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
                tables.append((table, "*"))
        for table, columns in tables:
            condition = " WHERE key='device'" if table == "meta" else ""
            if live.execute(f"SELECT {columns} FROM before.{table}{condition} EXCEPT SELECT {columns} FROM main.{table}{condition} LIMIT 1").fetchone():
                raise ValueError(f"Upgrade check failed for {table}")
        print("Verified original sessions:", live.execute("SELECT count(*) FROM before.sessions").fetchone()[0])
    else:
        raise ValueError("Unknown backup operation")
    live.close()

