"""
Guards against the "two doors" deadlock: a RunPython migration step that
touches the ORM without pinning `.using(schema_editor.connection.alias)`.

Why this matters: `just migrate` / `db_startup.py` apply migrations through
the `migrate` DB alias (a separate connection, sessionops/settings.py). Any
RunPython function's ORM call that doesn't explicitly use that same alias
silently opens a second connection on `default` instead. If an earlier
operation in the same migration is still holding a lock (e.g. AddIndex),
that second connection blocks on it forever -- while the first connection
sits idle waiting for the RunPython call to return. Neither side can move.

This script scans sessionops/migrations/*.py, finds every function passed to
RunPython, and flags any that call the ORM (`.objects.*`) without a
`.using(` anywhere in the same function body.

Run: uv run python scripts/check_migration_db_alias.py
Exit code 0 = clean, 1 = violations found.
"""

import ast
import sys
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "sessionops" / "migrations"

OBJECTS_CALL = ".objects."
USING_CALL = ".using("


def _runpython_func_names(tree: ast.Module) -> set[str]:
    """Names of functions passed as either arg to any RunPython(...) call."""
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            callee = node.func
            is_runpython = (isinstance(callee, ast.Attribute) and callee.attr == "RunPython") or (
                isinstance(callee, ast.Name) and callee.id == "RunPython"
            )
            if not is_runpython:
                continue
            for arg in node.args[:2]:
                if isinstance(arg, ast.Name):
                    names.add(arg.id)
    return names


def _violations(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(path))
    target_funcs = _runpython_func_names(tree)
    if not target_funcs:
        return []

    lines = source.splitlines()
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name in target_funcs:
            end = node.end_lineno or node.lineno
            body_text = "\n".join(lines[node.lineno - 1 : end])
            if OBJECTS_CALL in body_text and USING_CALL not in body_text:
                found.append(
                    f"{path.name}:{node.lineno}: '{node.name}' calls the ORM "
                    f"(`.objects.`) without `.using(schema_editor.connection.alias)` "
                    f"-- can deadlock against DDL locks when run via `--database migrate`."
                )
    return found


def main() -> int:
    violations = []
    for path in sorted(MIGRATIONS_DIR.glob("*.py")):
        if path.name == "__init__.py":
            continue
        violations.extend(_violations(path))

    if violations:
        print("Migration DB-alias check failed:\n")
        for v in violations:
            print(f"  - {v}")
        print(
            "\nFix: route the RunPython function's ORM calls through the same "
            "connection the migration itself is using, e.g.:\n"
            "  Model.objects.using(schema_editor.connection.alias).filter(...).update(...)"
        )
        return 1

    print(f"Migration DB-alias check passed ({len(list(MIGRATIONS_DIR.glob('*.py'))) - 1} files scanned).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
