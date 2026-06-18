import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'validator' ? 'validator' : 'labeller';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidator = role === 'validator';

  const copy = useMemo(
    () =>
      isValidator
        ? {
            title: 'Create validator account',
            subtitle:
              'Sign up to review labeller submissions, compare work against reference annotations, and assign scores.',
            button: 'Register as validator',
            steps: [
              'Sign in after registering',
              'Open the review queue',
              'Review submitted production tasks',
              'Assign scores and approve or reject',
            ],
          }
        : {
            title: 'Create labeller account',
            subtitle:
              'Sign up to label football video clips. Study terminology, pass tests, and complete tutorials before paid tasks.',
            button: 'Register as labeller',
            steps: [
              'Study the terminology guide',
              'Pass the knowledge test (80%+)',
              'Complete tutorials and pre-test',
              'Start labeling production tasks',
            ],
          },
    [isValidator]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(name, email, password, role);
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'validator' || user.role === 'checker') {
        navigate('/review');
      } else {
        navigate('/');
      }
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
            <strong>{isValidator ? 'After registering:' : 'Labeller path:'}</strong>
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
