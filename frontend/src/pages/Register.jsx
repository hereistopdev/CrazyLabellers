import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  isValidator,
  getAuthedHomePath,
} from '../utils/roles';

function resolveInitialRole(roleParam) {
  if (roleParam === 'validator') return 'validator';
  if (roleParam === 'video_manager' || roleParam === 'manager') return 'video_manager';
  return 'labeller';
}

const REGISTER_COPY = {
  labeller: {
    title: 'Create labeller account',
    subtitle:
      'Sign up to label football video clips. Study terminology, pass tests, and complete tutorials before paid tasks.',
    button: 'Register as labeller',
    stepsLabel: 'Labeller path:',
    steps: [
      'Study the terminology guide',
      'Pass the knowledge test (80%+)',
      'Complete tutorials and pre-test',
      'Start labeling production tasks',
    ],
  },
  validator: {
    title: 'Create validator account',
    subtitle:
      'Sign up to review labeller submissions. An admin must approve your account before you can access the review queue.',
    button: 'Register as validator',
    stepsLabel: 'After registering:',
    steps: [
      'Wait for admin approval',
      'Sign in once approved',
      'Open the review queue',
      'Score submitted production tasks',
    ],
  },
  video_manager: {
    title: 'Create manager account',
    subtitle:
      'Sign up to upload video clips and reference JSON files. An admin must approve your account before you can manage videos.',
    button: 'Register as manager',
    stepsLabel: 'After registering:',
    steps: [
      'Wait for admin approval',
      'Sign in once approved',
      'Open Manage Videos',
      'Upload clips and reference annotations',
    ],
  },
};

export default function Register() {
  const { register, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = resolveInitialRole(searchParams.get('role'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const copy = useMemo(() => REGISTER_COPY[role] || REGISTER_COPY.labeller, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(name, email, password, role);
      if (role === 'video_manager' && user.role !== 'video_manager') {
        logout();
        throw new Error(
          'Manager registration is not available on this server. Ask an admin to deploy the latest backend or create your account from the admin panel.'
        );
      }
      if (role === 'validator' && !isValidator(user)) {
        logout();
        throw new Error(
          'Validator registration is not available on this server. Ask an admin to deploy the latest backend.'
        );
      }
      navigate(getAuthedHomePath(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-badge">Shrinik</div>
        <h1>{copy.title}</h1>
        <p className="subtitle">{copy.subtitle}</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="role">Account type</label>
            <div className="auth-role-toggle">
              <label className={`auth-role-option${role === 'labeller' ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="labeller"
                  checked={role === 'labeller'}
                  onChange={() => setRole('labeller')}
                />
                Labeller
              </label>
              <label className={`auth-role-option${role === 'validator' ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="validator"
                  checked={role === 'validator'}
                  onChange={() => setRole('validator')}
                />
                Validator
              </label>
              <label className={`auth-role-option${role === 'video_manager' ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="video_manager"
                  checked={role === 'video_manager'}
                  onChange={() => setRole('video_manager')}
                />
                Manager
              </label>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your full name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@email.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account...' : copy.button}
          </button>
        </form>

        <div className="auth-steps">
          <p>
            <strong>{copy.stepsLabel}</strong>
          </p>
          <ol>
            {copy.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <p className="auth-footer">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
