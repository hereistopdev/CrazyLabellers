import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { isAdmin, isLabeller, isReviewer } from './utils/roles';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Terminology from './pages/Terminology';
import KnowledgeTest from './pages/KnowledgeTest';
import Assignments from './pages/Assignments';
import Labeling from './pages/Labeling';
import Admin from './pages/Admin';
import ManageLabellers from './pages/ManageLabellers';
import ManageVideos from './pages/ManageVideos';
import FinanceDashboard from './pages/FinanceDashboard';
import Earnings from './pages/Earnings';
import LabelingTest from './pages/LabelingTest';
import ReviewQueue from './pages/ReviewQueue';
import ReviewSubmission from './pages/ReviewSubmission';
import LabellerProfile from './pages/LabellerProfile';

function ProtectedRoute({ children, adminOnly = false, labellerOnly = false, reviewerOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin(user)) {
    return <Navigate to="/" replace />;
  }

  if (reviewerOnly && !isReviewer(user)) {
    return <Navigate to="/" replace />;
  }

  if (labellerOnly && !isLabeller(user)) {
    return <Navigate to={isReviewer(user) ? '/review' : '/admin'} replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/labeller/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/labeller/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="terminology" element={<Terminology />} />
        <Route
          path="test"
          element={
            <ProtectedRoute labellerOnly>
              <KnowledgeTest />
            </ProtectedRoute>
          }
        />
        <Route
          path="labeling-test"
          element={
            <ProtectedRoute labellerOnly>
              <LabelingTest />
            </ProtectedRoute>
          }
        />
        <Route
          path="assignments"
          element={
            <ProtectedRoute labellerOnly>
              <Assignments />
            </ProtectedRoute>
          }
        />
        <Route
          path="label/:id"
          element={
            <ProtectedRoute labellerOnly>
              <Labeling />
            </ProtectedRoute>
          }
        />
        <Route
          path="review"
          element={
            <ProtectedRoute reviewerOnly>
              <ReviewQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="review/:submissionId"
          element={
            <ProtectedRoute reviewerOnly>
              <ReviewSubmission />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/videos"
          element={
            <ProtectedRoute adminOnly>
              <ManageVideos />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/labellers"
          element={
            <ProtectedRoute adminOnly>
              <ManageLabellers />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/finance"
          element={
            <ProtectedRoute adminOnly>
              <FinanceDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="earnings"
          element={
            <ProtectedRoute labellerOnly>
              <Earnings />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute labellerOnly>
              <LabellerProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile/:id"
          element={
            <ProtectedRoute>
              <LabellerProfile />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
