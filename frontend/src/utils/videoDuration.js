export function readVideoDurationFromFile(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const duration = video.duration;
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video duration'));
    };

    video.src = url;
  });
}

export function resolvePlaybackDuration(mediaDuration, assignmentDuration, fallback = 30) {
  if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
    return mediaDuration;
  }
  if (Number.isFinite(assignmentDuration) && assignmentDuration > 0) {
    return assignmentDuration;
  }
  return fallback;
}
