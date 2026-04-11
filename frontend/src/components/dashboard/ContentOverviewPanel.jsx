import { formatTimestamp } from "../../utils/formatters.js";
import { EmptyState } from "./EmptyState.jsx";

function formatMetric(value) {
  return new Intl.NumberFormat("zh-TW").format(Number.isFinite(value) ? value : 0);
}

function getContentTitle(item) {
  return item.caption?.trim() ? item.caption : item.content_id ?? "未命名內容";
}

function renderItemCard(item, onSelectAccount) {
  return (
    <article className="content-card" key={`${item.accountKey}-${item.content_id ?? "item"}`}>
      <div className="content-card__top">
        <div>
          <p className="eyebrow">{item.platform}</p>
          <h3>{getContentTitle(item)}</h3>
        </div>
        <span className="count-chip">{`${formatMetric(item.views)} views`}</span>
      </div>

      <p className="content-card__meta">{`${item.clientName} · ${item.platform} · ${item.accountId}`}</p>
      <p className="content-card__meta muted">
        {`發布時間 ${formatTimestamp(item.published_at)} · 同步時間 ${formatTimestamp(item.syncedAt)}`}
      </p>

      <dl className="content-card__metrics">
        <div>
          <dt>Likes</dt>
          <dd>{formatMetric(item.likes)}</dd>
        </div>
        <div>
          <dt>Comments</dt>
          <dd>{formatMetric(item.comments)}</dd>
        </div>
        <div>
          <dt>Shares</dt>
          <dd>{formatMetric(item.shares)}</dd>
        </div>
      </dl>

      <div className="content-card__actions">
        <button className="secondary-action" onClick={() => onSelectAccount(item.accountKey)} type="button">
          查看帳號詳情
        </button>
        {item.url ? (
          <a className="text-action" href={item.url} rel="noreferrer" target="_blank">
            查看原始內容
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function ContentOverviewPanel({
  onSelectAccount,
  onSelectPlatform,
  platforms,
  selectedPlatform,
}) {
  if (platforms.length === 0) {
    return (
      <section className="panel detail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">內容總覽</p>
            <h2>跨平台內容表現</h2>
          </div>
        </div>

        <EmptyState message="目前沒有可顯示的內容快照，請先完成同步後再查看。" />
      </section>
    );
  }

  if (selectedPlatform !== "all") {
    const platformSection = platforms.find((entry) => entry.platform === selectedPlatform);

    return (
      <section className="panel detail-panel overview-panel">
        <div className="panel-header panel-header--stacked">
          <div>
            <p className="eyebrow">內容總覽</p>
            <h2>{`${selectedPlatform} 內容列表`}</h2>
            <p className="muted">
              {`${platformSection?.accountCount ?? 0} 個帳號 · ${platformSection?.contentCount ?? 0} 筆內容 · ${formatMetric(platformSection?.totalViews ?? 0)} views`}
            </p>
          </div>
          <button className="secondary-action" onClick={() => onSelectPlatform("all")} type="button">
            返回全部平台
          </button>
        </div>

        {platformSection?.items?.length ? (
          <div className="content-card-grid">
            {platformSection.items.map((item) => renderItemCard(item, onSelectAccount))}
          </div>
        ) : (
          <EmptyState compact message="此平台目前沒有可顯示的內容。" />
        )}
      </section>
    );
  }

  return (
    <section className="panel detail-panel overview-panel">
      <div className="panel-header panel-header--stacked">
        <div>
          <p className="eyebrow">內容總覽</p>
          <h2>跨平台內容表現</h2>
          <p className="muted">首頁優先展示各平台最具代表性的內容，點進帳號後再看完整設定與同步結果。</p>
        </div>
      </div>

      <div className="platform-overview-list">
        {platforms.map((platformSection) => (
          <section className="platform-section" key={platformSection.platform}>
            <div className="platform-section__header">
              <div>
                <h3>{platformSection.platform}</h3>
                <p className="muted">
                  {`${platformSection.accountCount} 個帳號 · ${platformSection.contentCount} 筆內容 · ${formatMetric(platformSection.totalViews)} views`}
                </p>
              </div>
              <button
                className="secondary-action"
                onClick={() => onSelectPlatform(platformSection.platform)}
                type="button"
              >
                查看全部
              </button>
            </div>

            {platformSection.previewItems.length ? (
              <div className="content-card-grid">
                {platformSection.previewItems.map((item) => renderItemCard(item, onSelectAccount))}
              </div>
            ) : (
              <EmptyState compact message="此平台目前沒有內容快照。" />
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
