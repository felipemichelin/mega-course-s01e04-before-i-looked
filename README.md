# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
(next) a morning digest of what ran overnight.

## MEGA S01E04 implementation

The morning digest is implemented and verified: 26 tests and typecheck pass. Both digest
routes share the reader; the status board links each sample night and shows event counts.
The rig listener binds only to 127.0.0.1. Source `runs/` fixtures are unchanged.

The reviewed plan is tracked by issues [#1](https://github.com/felipemichelin/mega-course-s01e04-before-i-looked/issues/1),
[#2](https://github.com/felipemichelin/mega-course-s01e04-before-i-looked/issues/2),
[#3](https://github.com/felipemichelin/mega-course-s01e04-before-i-looked/issues/3),
[#4](https://github.com/felipemichelin/mega-course-s01e04-before-i-looked/issues/4),
[#5](https://github.com/felipemichelin/mega-course-s01e04-before-i-looked/issues/5),
[#6](https://github.com/felipemichelin/mega-course-s01e04-before-i-looked/issues/6) and
[#7](https://github.com/felipemichelin/mega-course-s01e04-before-i-looked/issues/7).
Worker closing records identify integrated commits. The remaining cleanup issue stays open.

The [public static review copy](https://mega-course-s01e04-felipe.pages.dev/) was exported from
the actual route outside Git and uploaded to the owner's Blackout Media Cloudflare account.
Its public bytes match the local export. The course has acknowledged delivery to the reviewer;
this is not final challenge acceptance. The page still intentionally carries the lane marker.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

Working on it with an agent: start at [AGENTS.md](AGENTS.md).
