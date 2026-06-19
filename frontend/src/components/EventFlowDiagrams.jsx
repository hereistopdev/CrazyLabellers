import {
  decisionTrees,
  eventCategories,
  eventPairs,
  sequenceFlows,
  timingRules,
} from '../data/eventFlows';
import {
  formatOffset,
  frameOffsetEventTable,
  frameOffsetGroups,
  frameOffsetRules,
  immediateFollowUpRules,
} from '../config/frameOffsets';

function FlowSequence({ flow }) {
  return (
    <div className="flow-card">
      <div className="flow-card-header">
        <h3>{flow.title}</h3>
        <p>{flow.subtitle}</p>
      </div>
      <div className="flow-sequence">
        {flow.steps.map((step, index) => (
          <div key={`${flow.id}-${step.event}-${index}`} className="flow-sequence-item">
            <div
              className={`flow-node${step.optional ? ' optional' : ''}${step.highlight ? ' highlight' : ''}${step.branch ? ' branch' : ''}`}
            >
              <span className="flow-node-event">{step.event}</span>
              <span className="flow-node-note">{step.note}</span>
            </div>
            {index < flow.steps.length - 1 && (
              <div className={`flow-arrow${step.optional ? ' optional-arrow' : ''}`}>
                <span className="flow-arrow-line" />
                <span className="flow-arrow-head">▼</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventPairCard({ pair }) {
  return (
    <div className="pair-card">
      <h4>{pair.title}</h4>
      <p className="pair-desc">{pair.description}</p>
      <div className="pair-visual">
        <span className="pair-event">{pair.events[0]}</span>
        <span className="pair-connector">→</span>
        <span className="pair-event">{pair.events[1]}</span>
      </div>
      <p className="pair-rule">{pair.rule}</p>
    </div>
  );
}

function DecisionTree({ tree }) {
  return (
    <div className="decision-card">
      <h4>{tree.title}</h4>
      <p className="decision-question">{tree.question}</p>
      <div className="decision-branches">
        {tree.branches.map((branch) => (
          <div key={branch.answer} className="decision-branch">
            <div className="decision-condition">
              <span className="decision-label">If</span>
              {branch.condition}
            </div>
            <div className="decision-arrow">↓</div>
            <div className="decision-answer">{branch.answer}</div>
            <p className="decision-example">e.g. {branch.example}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventFlowDiagrams() {
  return (
    <div className="flow-diagrams">
      <section className="flow-section">
        <h2>Event categories</h2>
        <p className="flow-section-desc">
          All 19 events grouped by role. One clip can contain events from multiple categories.
        </p>
        <div className="category-grid">
          {eventCategories.map((cat) => (
            <div key={cat.name} className="category-card" style={{ '--cat-color': cat.color }}>
              <h4>{cat.name}</h4>
              <div className="category-events">
                {cat.events.map((ev) => (
                  <span key={ev} className="category-event-tag">
                    {ev}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flow-section">
        <h2>Paired events</h2>
        <p className="flow-section-desc">
          These events belong together. Mark both, always on different frames.
        </p>
        <div className="pair-grid">
          {eventPairs.map((pair) => (
            <EventPairCard key={pair.id} pair={pair} />
          ))}
        </div>
      </section>

      <section className="flow-section">
        <h2>Common sequences</h2>
        <p className="flow-section-desc">
          Typical event order in 30-second clips. Optional steps may not always appear.
          Branch steps mean one of the listed options. Notes include frame offsets where relevant.
        </p>
        <div className="sequence-grid">
          {sequenceFlows.map((flow) => (
            <FlowSequence key={flow.id} flow={flow} />
          ))}
        </div>
        <div className="flow-legend">
          <span className="legend-item">
            <span className="legend-swatch default" /> Required step
          </span>
          <span className="legend-item">
            <span className="legend-swatch optional" /> Optional step
          </span>
          <span className="legend-item">
            <span className="legend-swatch branch" /> One of options
          </span>
        </div>
      </section>

      <section className="flow-section">
        <h2>Decision guides</h2>
        <p className="flow-section-desc">
          When two events look similar, use these rules to pick the correct label.
        </p>
        <div className="decision-grid">
          {decisionTrees.map((tree) => (
            <DecisionTree key={tree.id} tree={tree} />
          ))}
        </div>
      </section>

      <section className="flow-section">
        <h2>Frame offset rules</h2>
        <p className="flow-section-desc">
          Pause on the visible moment, pick the event, and the app applies the offset (at 25 fps).
          Negative = saved earlier; positive = saved later; 0 = saved on the playhead frame.
        </p>
        <div className="offset-table-wrap">
          <table className="offset-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Offset</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {frameOffsetGroups.map((group) => (
                <tr key={group.offset}>
                  <td>{group.label}</td>
                  <td>
                    <span className={`offset-badge${group.offset > 0 ? ' positive' : ''}`}>
                      {formatOffset(group.offset)} frames
                    </span>
                  </td>
                  <td>{group.events.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="offset-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="offset-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Offset</th>
              </tr>
            </thead>
            <tbody>
              {frameOffsetEventTable.map((row) => (
                <tr key={row.eventType}>
                  <td>{row.eventType}</td>
                  <td>
                    <span className={`offset-badge${row.offset > 0 ? ' positive' : ''}`}>
                      {formatOffset(row.offset)} frames
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flow-section-desc" style={{ marginTop: '0.75rem' }}>
          Pass, Shot, Clearance, and Take on use 0 frames when marked immediately after Pass
          Received, Recovery, or Interception (see below).
        </p>
      </section>

      <section className="flow-section">
        <h2>Immediate follow-up exceptions</h2>
        <p className="flow-section-desc">
          When the same player performs two actions in one motion with no pause, the first event
          keeps its normal offset; the second is marked at the touch/contact frame (0).
        </p>
        <div className="followup-grid">
          {immediateFollowUpRules.map((rule) => (
            <div key={rule.id} className="followup-card">
              <div className="followup-visual">
                <span className="pair-event">{rule.after}</span>
                <span className="offset-badge">{formatOffset(rule.firstOffset)}f</span>
                <span className="pair-connector">→</span>
                <span className="pair-event">{rule.event}</span>
                <span className="offset-badge zero">{formatOffset(rule.secondOffset)}f</span>
              </div>
              <h4>{rule.title}</h4>
              <p>{rule.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flow-section">
        <h2>Timing rules</h2>
        <p className="flow-section-desc">Additional frame-level rules that apply across all clips.</p>
        <div className="timing-grid">
          {timingRules.map((rule) => (
            <div key={rule.rule} className="timing-card">
              <strong>{rule.rule}</strong>
              <span className="timing-events">{rule.events.join(' · ')}</span>
              {rule.offset !== undefined && (
                <span className={`offset-badge inline${rule.offset > 0 ? ' positive' : ''}`}>
                  {rule.offset > 0 ? `+${rule.offset}` : rule.offset} frames
                </span>
              )}
              <p>{rule.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
