import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h1>Admin — {user?.name}</h1>
        <p>Manage labellers, review submissions, and create video assignments.</p>
      </div>

      <div className="step-cards">
        <div className="step-card">
          <div className="step-number">1</div>
          <h3>Manage Labellers</h3>
          <p>Approve or reject labellers, view test scores, and assign videos to approved workers.</p>
          <div className="actions-row">
            <Link to="/admin/labellers" className="btn btn-primary btn-sm">
              Open labellers
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">2</div>
          <h3>Review Submissions</h3>
          <p>Check labeled videos submitted by labellers and approve or reject their work.</p>
          <div className="actions-row">
            <Link to="/admin" className="btn btn-secondary btn-sm">
              Submissions
            </Link>
          </div>
        </div>

        <div className="step-card">
          <div className="step-number">3</div>
          <h3>Terminology</h3>
          <p>Review event definitions and flow diagrams used to train labellers.</p>
          <div className="actions-row">
            <Link to="/terminology" className="btn btn-secondary btn-sm">
              View guide
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
