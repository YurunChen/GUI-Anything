import React from 'react';
import gaAvatar from './assets/wechat-ga-avatar.png';

function ExplorationCardMini({ card }) {
  const isRunning = card.running;
  const compact = card.compact;

  return (
    <article
      className={`exploration-card${isRunning ? ' is-running' : ''}${compact ? ' is-compact' : ''}`}
    >
      <div className="exploration-intent">
        {card.intentBadge ? (
          <span className="intent-badge">
            <span className="intent-bracket">「</span>
            {card.intentBadge}
            <span className="intent-bracket">」</span>
          </span>
        ) : null}
        <span className="intent-title">{card.intentTitle}</span>
      </div>

      <div className="observer-tool-meta term-dim">{card.toolMeta}</div>

      {!compact && card.summary ? (
        <div className="summary-block">
          <div className="summary-label">SUMMARY</div>
          <p>{card.summary}</p>
        </div>
      ) : null}

      {!compact && card.summaryPending ? (
        <div className="summary-block is-pending">
          <div className="summary-label">SUMMARY</div>
          <p>Summarizing...</p>
        </div>
      ) : null}
    </article>
  );
}

function FlowPreview({ preview }) {
  return (
    <div className="capability-visual">
      <div className="capability-visual-bar">{preview.label}</div>
      <div className="capability-visual-body cap-flow-observer">
        {preview.status ? (
          <div className="observer-status-line term-dim">{preview.status}</div>
        ) : null}
        <div className="exploration-timeline">
          {preview.explorations.map((card) => (
            <ExplorationCardMini card={card} key={card.intentTitle} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MapPreview({ preview }) {
  return (
    <div className="capability-visual">
      <div className="capability-visual-bar">{preview.label}</div>
      <div className="capability-visual-body">
        {preview.nodes.map((node, index) => (
          <div
            className={`cap-map-node${node.active ? ' is-active' : ''}${node.done ? ' is-done' : ''}`}
            key={node.label}
            style={{ '--cap-depth': index }}
          >
            <span className="cap-map-prefix" aria-hidden="true">
              {index === 0 ? '' : '└ '}
            </span>
            <span className="cap-map-label">{node.label}</span>
            {node.active ? <span className="cap-flow-dot" aria-hidden="true" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualStrategyPreview({ preview }) {
  return (
    <div className="visual-strategy-preview">
      <div className="visual-strategy-bar">
        <span>{preview.label}</span>
        <small>{preview.status}</small>
      </div>
      <div className="visual-strategy-body">
        {preview.modes.map((mode) => (
          <section
            className={`visual-mode visual-mode-${mode.type}`}
            aria-label={mode.title}
            key={mode.type}
          >
            <div className="visual-mode-head">
              <span className="visual-mode-mark">{mode.type}</span>
              <div className="visual-mode-title">{mode.title}</div>
            </div>
            {mode.type === 'text' ? (
              <article className="visual-text-card">
                <span className="visual-text-kind">knowledge card</span>
                <strong>{mode.heading}</strong>
                <p>{mode.text}</p>
                <div className="visual-text-tags" aria-hidden="true">
                  <span>note</span>
                  <span>reuse</span>
                </div>
              </article>
            ) : null}
            {mode.type === 'tui' ? (
              <div className="visual-tui-panel">
                <div className="visual-tui-prompt">$ ga flow</div>
                <div className="visual-tui-lines">
                  {mode.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {mode.type === 'gui' ? (
              <div className="visual-gui-window">
                <div className="visual-gui-chrome" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span>localhost</span>
                </div>
                <div className="visual-gui-canvas">
                  {mode.nodes.map((node) => (
                    <span className={node.active ? 'is-active' : ''} key={node.label}>
                      {node.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

function WikiPreview({ preview }) {
  return (
    <div className="wiki-file-preview">
      <div className="wiki-file-bar">
        <span>{preview.root}</span>
        <small>{preview.status}</small>
      </div>
      <div className="wiki-file-body">
        <div className="wiki-tree" aria-label={preview.treeLabel}>
          {preview.items.map((item) => (
            <div
              className={`wiki-tree-row ${item.type === 'folder' ? 'is-folder' : 'is-file'}${item.active ? ' is-active' : ''}`}
              key={item.name}
              style={{ '--wiki-depth': item.depth ?? 0 }}
            >
              <span className="wiki-tree-icon" aria-hidden="true">
                {item.type === 'folder' ? '▸' : 'md'}
              </span>
              <span>{item.name}</span>
            </div>
          ))}
        </div>
        <article className="wiki-md-card">
          <div className="wiki-md-title">{preview.fileTitle}</div>
          <p>{preview.excerpt}</p>
          <span>{preview.path}</span>
        </article>
      </div>
    </div>
  );
}

function WeChatAvatar({ from, meInitial }) {
  if (from === 'ga') {
    return (
      <span className="wechat-avatar wechat-avatar-logo" aria-hidden="true">
        <img src={gaAvatar} alt="" />
      </span>
    );
  }

  return (
    <span className="wechat-avatar" aria-hidden="true">
      {meInitial}
    </span>
  );
}

function WeChatPreview({ preview }) {
  return (
    <div className="capability-visual capability-visual-wechat">
      <div className="wechat-status">
        <span>{preview.contact}</span>
        <small>{preview.status}</small>
      </div>
      <div className="wechat-chat">
        {preview.messages.map((message) => (
          <div
            className={`wechat-message ${message.from === 'me' ? 'from-me' : 'from-ga'}`}
            key={`${message.from}-${message.text}`}
          >
            <WeChatAvatar from={message.from} meInitial={preview.meInitial} />
            <div className="wechat-bubble">
              <p>{message.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="wechat-input">
        <span>{preview.inputHint}</span>
      </div>
    </div>
  );
}

export function CapabilityPreview({ preview }) {
  if (!preview) return null;

  switch (preview.kind) {
    case 'flow':
      return <FlowPreview preview={preview} />;
    case 'map':
      return <MapPreview preview={preview} />;
    case 'visual':
      return <VisualStrategyPreview preview={preview} />;
    case 'wiki':
      return <WikiPreview preview={preview} />;
    case 'wechat':
      return <WeChatPreview preview={preview} />;
    default:
      return null;
  }
}
