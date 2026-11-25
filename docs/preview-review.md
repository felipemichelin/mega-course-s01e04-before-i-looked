# Digest preview review

D6 stays open until the reviewer receives the public HTTPS preview link and the plan’s issue list.

With rig running in the lane, export the digest from a terminal in the checkout. Use rig’s actual
port and a fresh filename in an existing directory outside every Git checkout.

```sh
PREVIEW_DIR=$(mktemp -d)
node scripts/export-preview.mjs \
  http://127.0.0.1:8787/digest/2026-10-28 \
  "$PREVIEW_DIR/digest.html"
```

The exporter saves the HTML response byte for byte, including the lane banner. A public preview
contains lane data. Keep the file out of the repository, issues, and chat attachments. The review
step needs an owner-approved public HTTPS host that supports replacing the object at the same URL.
Once the file is hosted, send the reviewer that URL and the issue list. See §3 of the
[Morning digest plan](plans/done/2026-10-29-morning-digest.md).

To verify the export locally, fetch the same URL again with `curl -fsS --noproxy '*'` and pipe it
to `cmp "$PREVIEW_DIR/digest.html" -`. A zero exit status confirms that the bytes match.

After review, restart rig with `LANE_MARKER` unset in both its environment and any `.env` loaded at
startup. Run the same exporter with a fresh local filename. Check that the banner says
`no marker set`. Obtain separate owner approval before overwriting the public preview, then publish
the marker-free HTML at the original URL and verify the banner at that URL.
