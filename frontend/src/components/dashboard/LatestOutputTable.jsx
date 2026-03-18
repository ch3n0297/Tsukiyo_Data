import { formatTimestamp } from "../../utils/formatters.js";

function toDisplayValue(value) {
  return value ?? "—";
}

export function LatestOutputTable({ latestOutput }) {
  const rows = Array.isArray(latestOutput?.rows) ? latestOutput.rows : [];
  const meta = latestOutput?.syncedAt
    ? `最新同步時間 ${formatTimestamp(latestOutput.syncedAt)} · ${latestOutput.rowCount} 筆資料`
    : "目前尚無同步輸出快照。";

  return (
    <section className="output-section">
      <div className="panel-header panel-header--compact">
        <div>
          <p className="eyebrow">最新快照</p>
          <h3>最新同步結果</h3>
        </div>
      </div>

      <p className="muted">{meta}</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>同步時間</th>
              <th>內容編號</th>
              <th>內容類型</th>
              <th>發布時間</th>
              <th>內容摘要</th>
              <th>內容連結</th>
              <th>觀看數</th>
              <th>按讚數</th>
              <th>留言數</th>
              <th>分享數</th>
              <th>資料狀態</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="table-empty" colSpan="11">
                  沒有可顯示的內容資料。
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.content_id ?? "row"}-${index}`}>
                  <td>{toDisplayValue(latestOutput?.syncedAt)}</td>
                  <td>{toDisplayValue(row.content_id)}</td>
                  <td>{toDisplayValue(row.content_type)}</td>
                  <td>{toDisplayValue(row.published_at)}</td>
                  <td>{toDisplayValue(row.caption)}</td>
                  <td>{toDisplayValue(row.url)}</td>
                  <td>{toDisplayValue(row.views ?? 0)}</td>
                  <td>{toDisplayValue(row.likes ?? 0)}</td>
                  <td>{toDisplayValue(row.comments ?? 0)}</td>
                  <td>{toDisplayValue(row.shares ?? 0)}</td>
                  <td>{toDisplayValue(row.data_status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
