import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatMoney } from '../utils/money';
import { useTableData } from '../hooks/useTableData';
import TableToolbar from '../components/TableToolbar';
import Pagination from '../components/Pagination';
import { PaymentAddressesDisplay } from '../components/PaymentAddressesSection';
import LabellerEarningsSection from '../components/LabellerEarningsSection';

function payoutNetworksLabel(paymentAddresses) {
  if (!paymentAddresses) return 'None';
  if (paymentAddresses.networksLabel) return paymentAddresses.networksLabel;
  const networks = ['trc20', 'erc20', 'bep20'].filter((key) => paymentAddresses[key]?.trim());
  if (!networks.length) return 'None';
  return networks.map((network) => network.toUpperCase()).join(', ');
}

export default function FinanceDashboard() {
  const [data, setData] = useState(null);
  const [selectedLabeller, setSelectedLabeller] = useState(null);
  const [ratePerPoint, setRatePerPoint] = useState(0.1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    api
      .getFinanceDashboard()
      .then((d) => {
        setData(d);
        setRatePerPoint(d.settings?.ratePerPoint ?? 0.1);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const earningsTable = useTableData(data?.earningsByLabeller || [], {
    searchKeys: ['name', 'email', 'status'],
    pageSize: 25,
    filterFn: (items, filters) =>
      items.filter((row) => filters.status === 'all' || row.status === filters.status),
    initialFilters: { status: 'all' },
  });

  const saveRate = async () => {
    try {
      await api.updateFinanceSettings({ ratePerPoint: parseFloat(ratePerPoint) });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openLabeller = async (id) => {
    try {
      const detail = await api.getFinanceLabeller(id);
      setSelectedLabeller(detail);
    } catch (err) {
      setError(err.message);
    }
  };

  const refreshSelectedLabeller = async (labellerId) => {
    const detail = await api.getFinanceLabeller(labellerId);
    setSelectedLabeller(detail);
    load();
    return detail;
  };

  const handleClearEarnings = async (note) => {
    if (!selectedLabeller?.labeller?._id) {
      throw new Error('No labeller selected');
    }
    const result = await api.clearLabellerEarnings(selectedLabeller.labeller._id, { note });
    await refreshSelectedLabeller(selectedLabeller.labeller._id);
    return result;
  };

  if (loading) return <div className="loading">Loading finance dashboard...</div>;

  const currency = data?.settings?.currency || 'USD';

  return (
    <div>
      <div className="page-header">
        <h1>Finance Dashboard</h1>
        <p>Track pending balances, payout history, and payment rates per task.</p>
        <Link to="/admin/labellers" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
          ← Manage labellers
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card highlight-earnings">
          <div className="value">{formatMoney(data?.totalPaidOut, currency)}</div>
          <div className="label">Total paid out</div>
        </div>
        <div className="stat-card">
          <div className="value">{formatMoney(data?.lifetimeTaskEarnings, currency)}</div>
          <div className="label">Lifetime task earnings</div>
        </div>
        <div className="stat-card">
          <div className="value">{data?.totalPointsAwarded || 0}</div>
          <div className="label">Total review points</div>
        </div>
        <div className="stat-card">
          <div className="value">{data?.pendingReviews || 0}</div>
          <div className="label">Awaiting review</div>
        </div>
      </div>

      <div className="card finance-settings" style={{ marginBottom: '1.5rem' }}>
        <h3>Payment rate</h3>
        <p className="form-hint">Earnings per task = review points × rate per point</p>
        <div className="rate-row">
          <label>
            Rate per point ({currency})
            <input
              type="number"
              step="0.01"
              min="0"
              value={ratePerPoint}
              onChange={(e) => setRatePerPoint(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveRate}>
            Save rate
          </button>
        </div>
        <p className="form-hint">
          Example: 85 points × {formatMoney(ratePerPoint, currency)} ={' '}
          {formatMoney(85 * parseFloat(ratePerPoint || 0), currency)}
        </p>
      </div>

      <div className="finance-layout">
        <div className="card table-wrap">
          <h3 style={{ padding: '1rem 1rem 0' }}>Pending labeller balances</h3>
          <TableToolbar
            search={earningsTable.search}
            onSearchChange={earningsTable.setSearch}
            searchPlaceholder="Search labellers…"
            totalCount={data?.earningsByLabeller?.length || 0}
            filteredCount={earningsTable.totalCount}
          >
            <select
              className="table-filter-select"
              value={earningsTable.filters.status}
              onChange={(e) => earningsTable.updateFilter('status', e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="passed_test">Passed test</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </TableToolbar>
          <table>
            <thead>
              <tr>
                <th>Labeller</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>Avg points</th>
                <th>Total points</th>
                <th>Pending balance</th>
                <th>Payout</th>
              </tr>
            </thead>
            <tbody>
              {(data?.earningsByLabeller || []).length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--text-muted)' }}>
                    No pending balances
                  </td>
                </tr>
              ) : earningsTable.totalCount === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--text-muted)' }}>
                    No labellers match your search
                  </td>
                </tr>
              ) : (
                earningsTable.paginated.map((l) => (
                  <tr key={l.labellerId} onClick={() => openLabeller(l.labellerId)} className="clickable-row">
                    <td>
                      <strong>{l.name}</strong>
                      <br />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{l.email}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${l.status}`}>
                        {l.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{l.tasksCompleted}</td>
                    <td>{l.avgPoints}</td>
                    <td>{l.totalPoints}</td>
                    <td className="earnings-cell">{formatMoney(l.pendingBalance, currency)}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          payoutNetworksLabel(l.paymentAddresses) === 'None'
                            ? 'status-pending'
                            : 'status-approved'
                        }`}
                      >
                        {payoutNetworksLabel(l.paymentAddresses)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination
            page={earningsTable.page}
            totalPages={earningsTable.totalPages}
            pageSize={earningsTable.pageSize}
            onPageChange={earningsTable.setPage}
            onPageSizeChange={earningsTable.setPageSize}
            totalCount={earningsTable.totalCount}
          />
        </div>

        <div className="card labeller-finance-detail">
          {!selectedLabeller ? (
            <p className="empty-detail">Select a labeller to manage payouts</p>
          ) : (
            <>
              <h3>{selectedLabeller.labeller.name}</h3>
              <p className="detail-email">{selectedLabeller.labeller.email}</p>
              <div className="payment-addresses-admin" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <PaymentAddressesDisplay
                  paymentAddresses={selectedLabeller.labeller.paymentAddresses}
                  updatedAt={selectedLabeller.labeller.paymentAddressesUpdatedAt}
                />
              </div>

              <LabellerEarningsSection
                earnings={{
                  summary: selectedLabeller.summary,
                  paymentHistory: selectedLabeller.paymentHistory,
                }}
                currency={currency}
                showAdminActions
                onClearEarnings={handleClearEarnings}
              />

              <h4>Task breakdown</h4>
              <ul className="finance-task-list">
                {selectedLabeller.tasks.map((t) => (
                  <li key={t.id} className={`finance-task finance-task-${t.status}`}>
                    <div className="finance-task-title">{t.title || 'Task'}</div>
                    <div className="finance-task-meta">
                      <span className={`status-badge status-${t.status === 'submitted' ? 'passed_test' : t.status}`}>
                        {t.status}
                      </span>
                      {t.earningsPaidOutAt ? (
                        <span className="status-badge status-approved">paid out</span>
                      ) : (
                        t.earnings > 0 && <span className="status-badge status-pending">unpaid</span>
                      )}
                      {t.reviewPoints != null && <span>{t.reviewPoints} pts</span>}
                      {t.earnings > 0 && <span className="earnings-cell">{formatMoney(t.earnings, currency)}</span>}
                    </div>
                    {t.reviewerNotes && <p className="finance-task-notes">{t.reviewerNotes}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
