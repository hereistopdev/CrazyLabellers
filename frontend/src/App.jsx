import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { isAdmin, isLabeller, isReviewer, canAccessReview, canAccessVideoManagement, getAuthedHomePath } from './utils/roles';
import { canUseLabeler } from './utils/labelerAccess';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Terminology from './pages/Terminology';
import KnowledgeTest from './pages/KnowledgeTest';
import Assignments from './pages/Assignments';
import Labeling from './pages/Labeling';
import Admin from './pages/Admin';
import ManageValidators from './pages/ManageValidators';
import ManageLabellers from './pages/ManageLabellers';
import ManageVideos from './pages/ManageVideos';
import ManageVideoManagers from './pages/ManageVideoManagers';
import FinanceDashboard from './pages/FinanceDashboard';
import Earnings from './pages/Earnings';
import LabelingTest from './pages/LabelingTest';
import PretestScoreReview from './pages/PretestScoreReview';
import Tutorials from './pages/Tutorials';
import ManageTasks from './pages/ManageTasks';
import ReviewQueue from './pages/ReviewQueue';
import ReviewSubmission from './pages/ReviewSubmission';
import LabellerProfile from './pages/LabellerProfile';
import FrequentQA from './pages/FrequentQA';

function ProtectedRoute({
  children,
  adminOnly = false,
  labellerOnly = false,
  reviewerOnly = false,
  labelerAccess = false,
  videoManagerAccess = false,
}) {
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

  if (videoManagerAccess && !canAccessVideoManagement(user)) {
    return <Navigate to="/" replace />;
  }

  if (reviewerOnly && !canAccessReview(user)) {
    return <Navigate to="/" replace />;
  }

  if (labelerAccess && !canUseLabeler(user)) {
    return <Navigate to="/" replace />;
  }

  if (labellerOnly && !isLabeller(user)) {
    return (
      <Navigate
        to={
          canAccessReview(user)
            ? '/review'
            : canAccessVideoManagement(user)
              ? '/admin/videos'
              : isAdmin(user)
                ? '/admin'
                : '/'
        }
        replace
      />
    );
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (user) {
    return <Navigate to={getAuthedHomePath(user)} replace />;
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
        path="/validator/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/manager/register"
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
        <Route path="faq" element={<FrequentQA />} />
        <Route
          path="test"
          element={
            <ProtectedRoute labellerOnly>
              <KnowledgeTest />
            </ProtectedRoute>
          }
        />
        <Route
          path="tutorials"
          element={
            <ProtectedRoute labellerOnly>
              <Tutorials />
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
          path="labeling-test/:assignmentId/review"
          element={
            <ProtectedRoute labellerOnly>
              <PretestScoreReview />
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
        <Route path="label/:id" element={<Labeling />} />
        <Route
          path="review"
          element={
            <ProtectedRoute reviewerOnly>
              <ReviewQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="review/assignment/:assignmentId"
          element={
            <ProtectedRoute reviewerOnly>
              <ReviewSubmission />
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
          path="admin/tasks"
          element={
            <ProtectedRoute videoManagerAccess>
              <ManageTasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/videos"
          element={
            <ProtectedRoute videoManagerAccess>
              <ManageVideos />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/video-managers"
          element={
            <ProtectedRoute adminOnly>
              <ManageVideoManagers />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/validators"
          element={
            <ProtectedRoute adminOnly>
              <ManageValidators />
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
