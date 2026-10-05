"""Isolated POSIX file-authority comparator; not production governance."""
import fcntl
import json
import os
import sys
import tempfile
import time

filename, command, expected, mode = sys.argv[1:]

def emit(message):
    print(json.dumps(message), flush=True)

emit({"type": "ready"})
if sys.stdin.readline().strip() != "go":
    raise RuntimeError("missing start barrier")

with open(filename + ".lock", "a+b") as lock:
    deadline = time.monotonic() + 2
    while True:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            break
        except BlockingIOError:
            if time.monotonic() >= deadline:
                raise RuntimeError("bounded lock wait exhausted")
            time.sleep(0.01)
    with open(filename, "r", encoding="utf-8") as source:
        state = json.load(source)
    previous = state["receipts"].get(command)
    if previous is not None:
        emit({"type": "result", "outcome": "REPLAY", "revision": previous, "command": command})
    elif state["revision"] != int(expected):
        emit({"type": "result", "outcome": "STALE_REJECTED", "command": command})
    else:
        state["revision"] += 1
        state["owner"] = command
        state["receipts"][command] = state["revision"]
        fd, temporary = tempfile.mkstemp(prefix="pending-", dir=os.path.dirname(filename))
        with os.fdopen(fd, "w", encoding="utf-8") as target:
            json.dump(state, target, sort_keys=True)
            target.flush()
            os.fsync(target.fileno())
        if mode == "crash":
            emit({"type": "prepared"})
            sys.stdin.read()  # Parent kills after prepared; unpublished file stays forensic.
            raise RuntimeError("crash injection did not occur")
        os.replace(temporary, filename)
        directory = os.open(os.path.dirname(filename), os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        emit({"type": "result", "outcome": "COMMITTED", "revision": state["revision"], "command": command})
