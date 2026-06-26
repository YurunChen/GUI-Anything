import React from 'react';

export function SessionBeats({ lifecycle }) {
  return (
    <div className="session-beats">
      <h2 className="section-title">{lifecycle.title}</h2>

      <div className="session-path-log" role="group" aria-label={lifecycle.title}>
        <div className="session-path-log-bar">
          <span>session path</span>
        </div>
        <ol className="session-path-rows">
          {lifecycle.items.map((item) => (
            <li className="session-path-row" key={item.id}>
              <div className="session-path-row-main">
                <span className="session-path-phase">{item.title}</span>
                <div className="session-path-evidence">
                  {item.scene.map((line) => (
                    <span className="session-path-line" key={line}>{line}</span>
                  ))}
                </div>
              </div>
              <p className="session-path-copy">{item.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
