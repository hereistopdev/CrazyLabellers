import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h1>Admin — {user?.name}</h1>
        <p>Manage labellers, review work, score tasks, and track payments.</p>
      </div>

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <h3>Manage Validators</h3>
          <p>Create validator accounts that review submitted tasks and assign scores.</p>
          <div className="actions-row">
            <Link to="/admin/validators" className="btn btn-primary btn-sm">
              Open validators
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">2</div>
          <h3>Manage Labellers</h3>
          <p>Add, remove, or manually approve labellers without requiring the knowledge test.</p>
          <div className="actions-row">
            <Link to="/admin/labellers" className="btn btn-primary btn-sm">
              Open labellers
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">3</div>
          <h3>Manage Tasks</h3>
          <p>Tutorial examples, pre-test clips, production groups, and frame explanations.</p>
          <div className="actions-row">
            <Link to="/admin/tasks" className="btn btn-primary btn-sm">
              Open tasks
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">4</div>
          <h3>Review & Score Tasks</h3>
          <p>Review labeled videos, assign review points (0–100), and calculate labeller earnings.</p>
          <div className="actions-row">
            <Link to="/review" className="btn btn-primary btn-sm">
              Review submissions
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">5</div>
          <h3>Finance Dashboard</h3>
          <p>See total payouts, per-labeller earnings, review points, and set the rate per point.</p>
          <div className="actions-row">
            <Link to="/admin/finance" className="btn btn-secondary btn-sm">
              Finance dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
