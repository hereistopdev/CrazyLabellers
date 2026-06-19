import { useState } from 'react';
import { formatMoney } from '../utils/money';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LabellerEarningsSection({
  earnings,
  currency = 'USD',
  showAdminActions = false,
  onClearEarnings,
}) {
  const [note, setNote] = useState('');
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  if (!earnings?.summary) return null;

  const { summary, paymentHistory = [] } = earnings;

  const handleClear = async () => {
    if (!onClearEarnings) return;
    const confirmed = window.confirm(
      `Mark ${formatMoney(summary.pendingBalance, currency)} as paid and clear pending balance for this labeller? Payment history will be saved.`
    );
    if (!confirmed) return;

    setClearing(true);
    setActionError('');
    setActionMessage('');
    try {
      const result = await onClearEarnings(note.trim());
      setActionMessage(result.message || 'Pending earnings cleared.');
      setNote('');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className={`profile-section labeller-earnings-section${className ? ` ${className}` : ''}`}>
      <h3>Earnings</h3>

      <div className="earnings-summary-grid">
        <div className="earnings-summary-card highlight-earnings">
          <strong>{formatMoney(summary.pendingBalance, currency)}</strong>
          <span>Current balance (unpaid)</span>
        </div>
        <div className="earnings-summary-card">
          <strong>{formatMoney(summary.lifetimeEarned, currency)}</strong>
          <span>Lifetime earned</span>
        </div>
        <div className="earnings-summary-card">
          <strong>{formatMoney(summary.lifetimePaidOut, currency)}</strong>
          <span>Lifetime paid out</span>
        </div>
        <div className="earnings-summary-card">
          <strong>{formatMoney(summary.pendingTaskEarnings, currency)}</strong>
          <span>Pending from tasks</span>
        </div>
        <div className="earnings-summary-card">
          <strong>{formatMoney(summary.pendingBadgeEarnings, currency)}</strong>
          <span>Pending from badges</span>
        </div>
      </div>

      {showAdminActions && (
        <div className="earnings-admin-actions">
          <label htmlFor="earnings-clear-note">Payment note (optional)</label>
          <textarea
            id="earnings-clear-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Transaction ID, batch reference, or admin note…"
            disabled={clearing}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleClear}
            disabled={clearing || summary.pendingBalance <= 0}
          >
            {clearing ? 'Processing…' : 'Clear earnings after payment'}
          </button>
          {summary.pendingBalance <= 0 && (
            <p className="earnings-admin-hint">No pending earnings to clear.</p>
          )}
        </div>
      )}

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {actionMessage && <div className="alert alert-success">{actionMessage}</div>}

      <h4 className="earnings-subheading">Payment history</h4>
      {paymentHistory.length === 0 ? (
        <p className="profile-empty">No payouts recorded yet.</p>
      ) : (
        <ul className="earnings-payment-history">
          {paymentHistory.map((payment) => (
            <li key={payment.id} className="earnings-payment-item">
              <div className="earnings-payment-header">
                <strong>{formatMoney(payment.totalAmount, payment.currency || currency)}</strong>
                <span>{formatDateTime(payment.paidAt)}</span>
              </div>
              <p className="earnings-payment-meta">
                Tasks {formatMoney(payment.taskEarnings, payment.currency || currency)}
                {' · '}
                Badges {formatMoney(payment.badgeEarnings, payment.currency || currency)}
                {payment.paidByName && ` · by ${payment.paidByName}`}
              </p>
              {payment.note && <p className="earnings-payment-note">{payment.note}</p>}
              {payment.lineItems?.length > 0 && (
                <ul className="earnings-payment-lines">
                  {payment.lineItems.map((item, index) => (
                    <li key={`${payment.id}-${item.type}-${index}`}>
                      {item.title} · {formatMoney(item.amount, payment.currency || currency)}
                      {item.reviewPoints != null && ` · ${item.reviewPoints} pts`}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
