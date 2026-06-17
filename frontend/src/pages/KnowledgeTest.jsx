import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function KnowledgeTest() {
  const { refreshUser } = useAuth();
  const [phase, setPhase] = useState('intro');
  const [questions, setQuestions] = useState([]);
  const [passThreshold, setPassThreshold] = useState(80);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startTest = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTestQuestions(10);
      setQuestions(data.questions);
      setPassThreshold(data.passThreshold);
      setAnswers({});
      setCurrentIndex(0);
      setResult(null);
      setPhase('testing');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const submitTest = async () => {
    const unanswered = questions.filter((q) => !answers[q._id]);
    if (unanswered.length > 0) {
      setError(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = questions.map((q) => ({
        questionId: q._id,
        selectedAnswer: answers[q._id],
      }));
      const data = await api.submitTest(payload);
      setResult(data);
      setPhase('result');
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (phase === 'intro') {
    return (
      <div>
        <div className="page-header">
          <h1>Knowledge Test</h1>
          <p>
            This test checks your understanding of football event terminology using real scenarios.
            You need {passThreshold}% or higher to unlock labeling assignments.
          </p>
        </div>

        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Before you start</h3>
          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            <li>10 random questions from a pool of scenario-based test cases</li>
            <li>Each question describes a football situation — pick the correct event type</li>
            <li>Review the <Link to="/terminology">terminology guide</Link> if unsure</li>
            <li>You can retake the test as many times as needed</li>
          </ul>

          {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '1.25rem' }}
            onClick={startTest}
            disabled={loading}
          >
            {loading ? 'Loading questions...' : 'Start test'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div>
        <div className="page-header">
          <h1>Test Results</h1>
        </div>

        <div className="card result-summary">
          <div className={`result-score ${result.passed ? 'passed' : 'failed'}`}>
            {result.score}%
          </div>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            {result.score}/{result.totalQuestions} correct — need {result.passThreshold}% to pass
          </p>

          {result.passed ? (
            <div className="alert alert-success" style={{ marginTop: '1rem' }}>
              Congratulations! You passed. Labeling assignments are now unlocked.
            </div>
          ) : (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              Not quite there. Review the terminology guide and try again.
            </div>
          )}

          <div className="actions-row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPhase('intro')}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={startTest}>
              Retake test
            </button>
            {result.passed && (
              <Link to="/assignments" className="btn btn-primary">
                Go to labeling
              </Link>
            )}
          </div>
        </div>

        <div className="explanation-list">
          <h2 style={{ fontSize: '1.1rem' }}>Review answers</h2>
          {result.explanations.map((ex) => (
            <div
              key={ex.questionId}
              className={`explanation-item ${ex.isCorrect ? 'correct' : 'incorrect'}`}
            >
              <p style={{ marginBottom: '0.5rem' }}>{ex.scenario}</p>
              <p style={{ fontSize: '0.88rem' }}>
                Your answer: <strong>{ex.selectedAnswer}</strong>
                {!ex.isCorrect && (
                  <> — Correct: <strong>{ex.correctAnswer}</strong></>
                )}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {ex.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const current = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const allAnswered = questions.every((q) => answers[q._id]);

  return (
    <div>
      <div className="page-header">
        <h1>Knowledge Test</h1>
      </div>

      <div className="test-progress">
        <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="question-card">
        <p className="question-scenario">{current.scenario}</p>

        <div className="options-list">
          {current.options.map((option) => (
            <button
              key={option}
              type="button"
              className={`option-btn${answers[current._id] === option ? ' selected' : ''}`}
              onClick={() => selectAnswer(current._id, option)}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="actions-row" style={{ marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={goPrev}
            disabled={currentIndex === 0}
          >
            Previous
          </button>
          {currentIndex < questions.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={goNext}>
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitTest}
              disabled={!allAnswered || loading}
            >
              {loading ? 'Submitting...' : 'Submit test'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
