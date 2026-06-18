import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isValidator, canAccessReview, roleLabel } from '../utils/roles';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(user);
  const validator = isValidator(user);
  const validatorApproved = validator && canAccessReview(user);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <nav className="navbar">
        <NavLink to="/" className="navbar-brand">
          <span className="brand-icon">⚽</span>
          Shrinik
        </NavLink>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Dashboard
          </NavLink>

          {admin ? (
            <>
              <NavLink
                to="/admin/tasks"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Tasks
              </NavLink>
              <NavLink
                to="/admin/videos"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Videos
              </NavLink>
              <NavLink
                to="/admin/validators"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Validators
              </NavLink>
              <NavLink
                to="/admin/labellers"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Labellers
              </NavLink>
              <NavLink
                to="/admin/finance"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Finance
              </NavLink>
              <NavLink
                to="/review"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Reviews
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Admin
              </NavLink>
            </>
          ) : validator ? (
            <>
              {validatorApproved && (
                <NavLink
                  to="/review"
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  Reviews
                </NavLink>
              )}
              <NavLink
                to="/terminology"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Terminology
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/terminology"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Terminology
              </NavLink>
              <NavLink to="/test" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                Knowledge Test
              </NavLink>
              <NavLink
                to="/tutorials"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Tutorials
              </NavLink>
              <NavLink
                to="/labeling-test"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Labeling test
              </NavLink>
              <NavLink
                to="/assignments"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Labeling
              </NavLink>
              <NavLink
                to="/earnings"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Earnings
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                Profile
              </NavLink>
            </>
          )}

          {admin && (
            <NavLink
              to="/terminology"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              Terminology
            </NavLink>
          )}

          <div className="nav-user">
            <span className="user-badge">
              {user?.name}
              <span className={`role-badge role-${user?.role}`}>{roleLabel(user)}</span>
              {!admin && (
                <span className={`status-badge status-${user?.status}`} style={{ marginLeft: 4 }}>
                  {user?.status?.replace('_', ' ')}
                </span>
              )}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
