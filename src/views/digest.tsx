import type { NightDigest } from '../digest/types.js';

export function DigestPage({ digest }: { digest: NightDigest }) {
  const rows = [...digest.rows].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);

  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.badLines > 0 && (
        <p class="warn">skipped malformed lines ({digest.badLines})</p>
      )}
      {rows.length === 0 ? (
        <p class="mute">{digest.badLines > 0 ? 'no valid runs' : 'nothing ran'}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">job</th>
              <th scope="col">owner</th>
              <th scope="col">runs</th>
              <th scope="col">retries</th>
              <th scope="col">last status</th>
              <th scope="col">last error</th>
              <th scope="col">first at</th>
              <th scope="col">last at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr>
                <th scope="row">{row.job}</th>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>{row.retries >= 3 ? <strong class="warn">{row.retries}</strong> : row.retries}</td>
                <td>{row.lastStatus === 'fail' ? <strong class="warn">{row.lastStatus}</strong> : row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
