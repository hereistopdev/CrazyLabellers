import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LabelingChatbot({ open, onClose, assignment, lastEventType, fps }) {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedFaqId, setSavedFaqId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const context = {
    page: 'labeling',
    assignmentKind: assignment?.kind,
    assignmentTitle: assignment?.title,
    lastEventType: lastEventType?.eventType || lastEventType || undefined,
    fps: fps || assignment?.fps,
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, messages, scrollToBottom]);

  const resetChat = () => {
    setConversationId(null);
    setMessages([]);
    setInput('');
    setError('');
    setSavedFaqId(null);
  };

  const handleClose = () => {
    onClose();
  };

  const sendMessage = async ({ message, selectedOption } = {}) => {
    const text = (selectedOption || message || input).trim();
    if (!text || loading) return;

    setLoading(true);
    setError('');

    const optimisticUser = {
      role: 'user',
      content: text,
      selectedOption: selectedOption || undefined,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    if (!selectedOption) setInput('');

    try {
      const data = await api.sendHelpChat({
        conversationId,
        message: selectedOption ? undefined : text,
        selectedOption,
        assignmentId: assignment?._id,
        context,
      });

      setConversationId(data.conversation._id);
      setMessages(data.conversation.messages || []);

      if (data.frequentQA?._id) {
        setSavedFaqId(data.frequentQA._id);
      }
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
      if (!selectedOption) setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage({ message: input });
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const awaitingOption =
    lastAssistant?.messageType === 'clarify' &&
    lastAssistant?.options?.length > 0 &&
    !loading;

  return (
    <>
      <div
        className={`labeling-chatbot-backdrop${open ? ' open' : ''}`}
        onClick={handleClose}
        aria-hidden={!open}
      />
      <aside
        className={`labeling-chatbot-panel${open ? ' open' : ''}`}
        aria-hidden={!open}
        aria-label="Labeling help chatbot"
      >
        <header className="labeling-chatbot-header">
          <div>
            <h2>Labeling assistant</h2>
            <p>Ask about event definitions and uncertain cases</p>
          </div>
          <div className="labeling-chatbot-header-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetChat}>
              New chat
            </button>
            <button
              type="button"
              className="labeling-chatbot-close"
              onClick={handleClose}
              aria-label="Close chatbot"
            >
              ×
            </button>
          </div>
        </header>

        <div className="labeling-chatbot-messages">
          {messages.length === 0 && (
            <div className="labeling-chatbot-welcome">
              <p>
                I help with <strong>official football event labeling</strong> for this project —
                terminology, frame timing, and uncertain clip situations.
              </p>
              <p className="labeling-chatbot-welcome-hint">
                I cannot answer general questions, coding, or topics unrelated to labeling. I may
                ask follow-up options before giving a recommendation.
              </p>
              <Link to="/faq" className="labeling-chatbot-faq-link" onClick={handleClose}>
                Browse Frequent Q&amp;A →
              </Link>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={`${msg.createdAt || index}-${msg.role}`}
              className={[
                'labeling-chatbot-message',
                `labeling-chatbot-message-${msg.role}`,
                msg.messageType === 'refuse' ? 'labeling-chatbot-message-refused' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="labeling-chatbot-message-meta">
                {msg.role === 'assistant' ? 'Assistant' : 'You'}
                {msg.createdAt && <span>{formatTime(msg.createdAt)}</span>}
              </div>
              <div className="labeling-chatbot-message-body">{msg.content}</div>
              {msg.role === 'assistant' && msg.messageType === 'answer' && (
                <span className="labeling-chatbot-answer-badge">Final recommendation</span>
              )}
              {msg.role === 'assistant' && msg.messageType === 'refuse' && (
                <span className="labeling-chatbot-refuse-badge">Out of scope</span>
              )}
            </div>
          ))}

          {awaitingOption && (
            <div className="labeling-chatbot-options">
              <span className="labeling-chatbot-options-label">Choose an option:</span>
              {lastAssistant.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="labeling-chatbot-option-btn"
                  disabled={loading}
                  onClick={() => sendMessage({ selectedOption: option })}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {savedFaqId && (
            <div className="labeling-chatbot-saved">
              Saved to{' '}
              <Link to={`/faq?id=${savedFaqId}`} onClick={handleClose}>
                Frequent Q&amp;A
              </Link>
            </div>
          )}

          {error && <div className="alert alert-error labeling-chatbot-error">{error}</div>}
          <div ref={messagesEndRef} />
        </div>

        <form className="labeling-chatbot-input-bar" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              awaitingOption
                ? 'Pick an option above, or type more detail…'
                : 'Describe the situation or ask a labeling question…'
            }
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
            {loading ? 'Thinking…' : 'Send'}
          </button>
        </form>
      </aside>
    </>
  );
}
