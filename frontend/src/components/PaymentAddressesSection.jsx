import { useEffect, useState } from 'react';
import { api } from '../api';

const NETWORKS = [
  {
    key: 'trc20',
    label: 'TRC20 (Tron USDT)',
    placeholder: 'T...',
    hint: '34-character Tron address starting with T',
  },
  {
    key: 'erc20',
    label: 'ERC20 (Ethereum USDT)',
    placeholder: '0x...',
    hint: '42-character address starting with 0x',
  },
  {
    key: 'bep20',
    label: 'BEP20 (BSC USDT)',
    placeholder: '0x...',
    hint: '42-character BSC address starting with 0x',
  },
];

const EMPTY_ADDRESSES = { trc20: '', erc20: '', bep20: '' };

function formatUpdatedAt(value) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function copyText(text) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

export function PaymentAddressesDisplay({ paymentAddresses, updatedAt, title = 'USDT payout addresses' }) {
  const addresses = paymentAddresses || EMPTY_ADDRESSES;
  const hasAny = paymentAddresses?.hasAny ?? NETWORKS.some(({ key }) => addresses[key]?.trim());

  return (
    <div className="payment-addresses-display">
      <h3>{title}</h3>
      {!hasAny ? (
        <p className="detail-muted">No payout address on file yet.</p>
      ) : (
        <ul className="payment-address-list">
          {NETWORKS.map(({ key, label }) => {
            const value = addresses[key]?.trim();
            if (!value) return null;
            return (
              <li key={key} className="payment-address-item">
                <div className="payment-address-label">{label}</div>
                <div className="payment-address-value-row">
                  <code className="payment-address-value">{value}</code>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyText(value)}
                  >
                    Copy
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {updatedAt && (
        <p className="detail-muted payment-address-updated">Last updated {formatUpdatedAt(updatedAt)}</p>
      )}
    </div>
  );
}

export default function PaymentAddressesForm({ compact = false }) {
  const [addresses, setAddresses] = useState(EMPTY_ADDRESSES);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getMyPaymentAddresses()
      .then((data) => {
        const next = data.paymentAddresses || EMPTY_ADDRESSES;
        setAddresses({
          trc20: next.trc20 || '',
          erc20: next.erc20 || '',
          bep20: next.bep20 || '',
        });
        setUpdatedAt(data.updatedAt || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setAddresses((prev) => ({ ...prev, [key]: value }));
    setMessage('');
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await api.updateMyPaymentAddresses(addresses);
      const next = data.paymentAddresses || EMPTY_ADDRESSES;
      setAddresses({
        trc20: next.trc20 || '',
        erc20: next.erc20 || '',
        bep20: next.bep20 || '',
      });
      setUpdatedAt(data.updatedAt || null);
      setMessage('Payout addresses saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="payment-addresses-form card">Loading payout addresses...</div>;
  }

  return (
    <div className={`payment-addresses-form card${compact ? ' payment-addresses-form--compact' : ''}`}>
      <h2 style={{ fontSize: compact ? '1rem' : '1.1rem', marginBottom: '0.35rem' }}>
        USDT payout addresses
      </h2>
      <p className="detail-muted" style={{ marginBottom: '1rem' }}>
        Add one or more wallet addresses so admin can pay you in USDT. Only send USDT on the
        matching network — wrong network means lost funds.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form onSubmit={handleSave}>
        {NETWORKS.map(({ key, label, placeholder, hint }) => (
          <div className="form-group" key={key}>
            <label htmlFor={`payment-${key}`}>{label}</label>
            <input
              id={`payment-${key}`}
              type="text"
              value={addresses[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="form-hint" style={{ marginBottom: 0 }}>
              {hint}
            </p>
          </div>
        ))}

        <div className="actions-row">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save payout addresses'}
          </button>
        </div>
      </form>

      {updatedAt && (
        <p className="detail-muted payment-address-updated" style={{ marginTop: '0.75rem' }}>
          Last updated {formatUpdatedAt(updatedAt)}
        </p>
      )}
    </div>
  );
}
