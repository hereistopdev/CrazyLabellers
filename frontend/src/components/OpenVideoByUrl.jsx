import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  extractAssignmentIdFromLabelUrl,
  isOpenableVideoUrl,
  practiceLabelPath,
} from '../utils/videoUrl';

export default function OpenVideoByUrl({ onError, onSuccess, className = '' } = {}) {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [opening, setOpening] = useState(false);

  const openVideo = async (event) => {
    event.preventDefault();
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      onError?.('Enter a video URL');
      return;
    }

    const assignmentId = extractAssignmentIdFromLabelUrl(trimmed);
    if (assignmentId) {
      onSuccess?.('Opening task…');
      navigate(`/label/${assignmentId}`);
      return;
    }

    if (!isOpenableVideoUrl(trimmed)) {
      onError?.('Enter a valid video URL (https://… ending in .mp4 or similar)');
      return;
    }

    setOpening(true);
    onError?.('');
    try {
      onSuccess?.('Opening practice video…');
      navigate(practiceLabelPath(trimmed));
    } catch (err) {
      onError?.(err.message || 'Could not open that video');
    } finally {
      setOpening(false);
    }
  };

  return (
    <form
      className={`open-video-by-url${className ? ` ${className}` : ''}`}
      onSubmit={openVideo}
    >
      <label className="open-video-by-url-label" htmlFor="open-video-url-input">
        Open video by URL
      </label>
      <div className="open-video-by-url-row">
        <input
          id="open-video-url-input"
          type="text"
          className="open-video-by-url-input"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://scoredata.me/chunks/….mp4"
          disabled={opening}
        />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={opening || !videoUrl.trim()}>
          {opening ? 'Opening…' : 'Open'}
        </button>
      </div>
      <p className="open-video-by-url-hint">
        Paste any video URL to practice labeling for free — no task assignment needed. Example:{' '}
        <code>https://scoredata.me/chunks/ce3738c2ab4a4cfa94e1abeb5f411b.mp4</code>
      </p>
    </form>
  );
}
