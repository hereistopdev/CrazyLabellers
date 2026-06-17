import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <nav className="navbar">
        <NavLink to="/" className="navbar-brand">
          <span className="brand-icon">⚽</span>
          Football Labeling
        </NavLink>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Dashboard
          </NavLink>
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
            to="/assignments"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Labeling
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              Admin
            </NavLink>
          )}

          <div className="nav-user">
            <span className="user-badge">
              {user?.name}
              <span className={`status-badge status-${user?.status}`} style={{ marginLeft: 8 }}>
                {user?.status?.replace('_', ' ')}
              </span>
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
