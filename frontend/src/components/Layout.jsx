import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isValidator, isVideoManager, canAccessReview, canAccessVideoManagement, roleLabel } from '../utils/roles';
import { canAccessImageLabeling } from '../utils/labelerAccess';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const admin = isAdmin(user);
  const validator = isValidator(user);
  const videoManager = isVideoManager(user);
  const validatorApproved = validator && canAccessReview(user);
  const videoManagerApproved = videoManager && canAccessVideoManagement(user);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  return (
    <div className="app-shell">
      <nav className="navbar">
        <NavLink to="/" className="navbar-brand">
          <span className="brand-icon">⚽</span>
          Shrinik
        </NavLink>

        <button
          type="button"
          className={`nav-toggle${menuOpen ? ' nav-toggle--open' : ''}`}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>

        {menuOpen && (
          <button
            type="button"
            className="nav-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <div className={`nav-links${menuOpen ? ' open' : ''}`}>
          <NavLink to="/" end className={navClass} onClick={() => setMenuOpen(false)}>
            Dashboard
          </NavLink>

          {admin ? (
            <>
              <NavLink to="/admin/tasks" className={navClass} onClick={() => setMenuOpen(false)}>
                Tasks
              </NavLink>
              <NavLink to="/admin/videos" className={navClass} onClick={() => setMenuOpen(false)}>
                Videos
              </NavLink>
              <NavLink to="/admin/images" className={navClass} onClick={() => setMenuOpen(false)}>
                Images
              </NavLink>
              <NavLink
                to="/admin/video-managers"
                className={navClass}
                onClick={() => setMenuOpen(false)}
              >
                Video managers
              </NavLink>
              <NavLink
                to="/admin/validators"
                className={navClass}
                onClick={() => setMenuOpen(false)}
              >
                Validators
              </NavLink>
              <NavLink
                to="/admin/labellers"
                className={navClass}
                onClick={() => setMenuOpen(false)}
              >
                Labellers
              </NavLink>
              <NavLink to="/admin/finance" className={navClass} onClick={() => setMenuOpen(false)}>
                Finance
              </NavLink>
              <NavLink to="/review" className={navClass} onClick={() => setMenuOpen(false)}>
                Reviews
              </NavLink>
              <NavLink to="/admin" className={navClass} onClick={() => setMenuOpen(false)}>
                Admin
              </NavLink>
            </>
          ) : videoManager ? (
            <>
              {videoManagerApproved && (
                <>
                  <NavLink to="/admin/videos" className={navClass} onClick={() => setMenuOpen(false)}>
                    Videos
                  </NavLink>
                  <NavLink to="/admin/images" className={navClass} onClick={() => setMenuOpen(false)}>
                    Images
                  </NavLink>
                  <NavLink to="/admin/tasks" className={navClass} onClick={() => setMenuOpen(false)}>
                    Tasks & groups
                  </NavLink>
                </>
              )}
            </>
          ) : validator ? (
            <>
              {validatorApproved && (
                <NavLink to="/review" className={navClass} onClick={() => setMenuOpen(false)}>
                  Reviews
                </NavLink>
              )}
              <NavLink to="/terminology" className={navClass} onClick={() => setMenuOpen(false)}>
                Terminology
              </NavLink>
              <NavLink to="/faq" className={navClass} onClick={() => setMenuOpen(false)}>
                Frequent Q&amp;A
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/terminology" className={navClass} onClick={() => setMenuOpen(false)}>
                Terminology
              </NavLink>
              <NavLink to="/test" className={navClass} onClick={() => setMenuOpen(false)}>
                Knowledge Test
              </NavLink>
              <NavLink to="/tutorials" className={navClass} onClick={() => setMenuOpen(false)}>
                Tutorials
              </NavLink>
              <NavLink to="/labeling-test" className={navClass} onClick={() => setMenuOpen(false)}>
                Labeling test
              </NavLink>
              <NavLink to="/assignments" className={navClass} onClick={() => setMenuOpen(false)}>
                Labeling
              </NavLink>
              {canAccessImageLabeling(user) && (
                <NavLink to="/image-assignments" className={navClass} onClick={() => setMenuOpen(false)}>
                  Image projects
                </NavLink>
              )}
              <NavLink to="/faq" className={navClass} onClick={() => setMenuOpen(false)}>
                Frequent Q&amp;A
              </NavLink>
              <NavLink to="/earnings" className={navClass} onClick={() => setMenuOpen(false)}>
                Earnings
              </NavLink>
              <NavLink to="/profile" className={navClass} onClick={() => setMenuOpen(false)}>
                Profile
              </NavLink>
            </>
          )}

          {admin && (
            <>
              <NavLink to="/terminology" className={navClass} onClick={() => setMenuOpen(false)}>
                Terminology
              </NavLink>
              <NavLink to="/faq" className={navClass} onClick={() => setMenuOpen(false)}>
                Frequent Q&amp;A
              </NavLink>
            </>
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
