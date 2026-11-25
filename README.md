# rig

Keeps a lane's lights on while nobody is in it with a heartbeat every minute, a status board,
and a morning digest of what ran overnight.

## MEGA S01E04 implementation

The morning digest is implemented and verified: 26 tests and typecheck pass. Both digest
routes share the reader; the status board links each sample night and shows event counts.
The rig listener binds only to 127.0.0.1. Source `runs/` fixtures are unchanged.

The course reviewer saw the public preview. After review, the owner approved replacing it at
the original URL. On 2026-11-25, the URL returned HTTP 200 and matched the 2,399-byte export
from the running rig. The banner reads `no marker set`, and the digest still shows five jobs and
one malformed line. The run log totals are 10 ok, 4 retry, and 1 fail.
[Public preview](https://mega-course-s01e04-felipe.pages.dev/)

The completed plan and its seven GitHub issues are recorded in the
[Morning digest plan](docs/plans/done/2026-10-29-morning-digest.md).

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

Working on it with an agent: start at [AGENTS.md](AGENTS.md).
