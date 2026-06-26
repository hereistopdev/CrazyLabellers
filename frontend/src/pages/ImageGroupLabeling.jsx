import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { canUseLabeler } from '../utils/labelerAccess';
import { isAdmin } from '../utils/roles';
import { getUserId, isAssignedToUser } from '../utils/userId';
import ImageGroupCanvasStack from '../components/ImageGroupCanvasStack';
import ImageKeypointMarkPanel from '../components/ImageKeypointMarkPanel';
import ImageGroupGallery from '../components/ImageGroupGallery';
import {
  IMAGE_KEYPOINT_LABEL_IDS,
  emptyKeypointsMap,
  countMarkedKeypoints,
  keypointsMapToList,
} from '../config/imageKeypoints';
import {
  loadImageKeypointDraft,
  saveImageKeypointDraft,
  clearImageKeypointDraft,
  mergeDraftIntoCache,
  cacheToDraftPayload,
} from '../utils/imageKeypointDraftStorage';
import {
  buildKeypointExportPayload,
  getKeypointExportFilename,
  downloadJsonFile,
} from '../utils/imageKeypointExport';

function pickInitialImageId(images, user, requestedId) {
  if (requestedId && images.some((row) => row._id === requestedId)) {
    return requestedId;
  }
  const firstMine = images.find(
    (row) => row.status !== 'available' && isAssignedToUser(row.assignedTo, user)
  );
  return firstMine?._id || images[0]?._id || '';
}

function syncGalleryProgress(images, keypointsById) {
  return images.map((row) => {
    const entry = keypointsById[row._id];
    const markedCount = countMarkedKeypoints(entry?.keypoints);
    const isComplete = markedCount >= IMAGE_KEYPOINT_LABEL_IDS.length;
    return {
      ...row,
      markedCount,
      isComplete,
      submissionStatus: entry?.status || row.submissionStatus || 'draft',
    };
  });
}

export default function ImageGroupLabeling() {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const keypointsByIdRef = useRef({});
  const initialImageRef = useRef(searchParams.get('image'));
  const dimensionsRef = useRef({});

  const [workspace, setWorkspace] = useState(null);
  const [keypointsById, setKeypointsById] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [activeLabel, setActiveLabel] = useState('pitch');
  const [loading, setLoading] = useState(true);
  const [draftSaved, setDraftSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const images = useMemo(
    () => syncGalleryProgress(workspace?.images || [], keypointsById),
    [workspace?.images, keypointsById]
  );

  const selectedImage = useMemo(
    () => images.find((row) => row._id === selectedId) || null,
    [images, selectedId]
  );

  const labelableIds = useMemo(() => {
    if (isAdmin(user)) return new Set(images.map((row) => row._id));
    return new Set(
      images
        .filter((row) => row.status !== 'available' && isAssignedToUser(row.assignedTo, user))
        .map((row) => row._id)
    );
  }, [images, user]);

  const currentEntry = keypointsById[selectedId] || { keypoints: emptyKeypointsMap(), status: 'draft' };
  const keypoints = currentEntry.keypoints;
  const submissionStatus = currentEntry.status;

  const canLabelSelected = selectedId && labelableIds.has(selectedId);
  const readOnly =
    !canLabelSelected || submissionStatus === 'submitted' || submissionStatus === 'approved';

  const projectSubmitted = useMemo(
    () =>
      labelableIds.size > 0 &&
      [...labelableIds].every(
        (id) => keypointsById[id]?.status === 'submitted' || keypointsById[id]?.status === 'approved'
      ),
    [labelableIds, keypointsById]
  );

  const applyWorkspace = useCallback(
    (data) => {
      if (!data) return;
      const draft = loadImageKeypointDraft(groupId, user);
      const cache = mergeDraftIntoCache(data.images, draft, user);
      keypointsByIdRef.current = cache;
      setKeypointsById(cache);
      setWorkspace(data);
      setSelectedId(pickInitialImageId(data.images, user, initialImageRef.current));
    },
    [groupId, user]
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getImageGroupWorkspace(groupId);
      applyWorkspace(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [groupId, applyWorkspace]);

  useEffect(() => {
    if (!canUseLabeler(user)) {
      navigate('/');
      return;
    }
    loadWorkspace();
  }, [user, groupId, navigate, loadWorkspace]);

  useEffect(() => {
    if (!selectedId) return;
    setSearchParams({ image: selectedId }, { replace: true });
  }, [selectedId, setSearchParams]);

  const persistLocalDraft = useCallback(
    (nextCache) => {
      saveImageKeypointDraft(groupId, user, cacheToDraftPayload(nextCache));
      setDraftSaved(true);
    },
    [groupId, user]
  );

  const updateKeypointsCache = useCallback(
    (assignmentId, map, status) => {
      setKeypointsById((prev) => {
        const next = {
          ...prev,
          [assignmentId]: {
            keypoints: map,
            status: status ?? prev[assignmentId]?.status ?? 'draft',
          },
        };
        keypointsByIdRef.current = next;
        persistLocalDraft(next);
        return next;
      });
    },
    [persistLocalDraft]
  );

  const updateKeypoints = useCallback(
    (updater) => {
      if (!selectedId || readOnly) return;
      const prev = keypointsByIdRef.current[selectedId]?.keypoints || emptyKeypointsMap();
      const next = typeof updater === 'function' ? updater(prev) : updater;
      updateKeypointsCache(selectedId, next);
    },
    [selectedId, readOnly, updateKeypointsCache]
  );

  const handleSelectImage = useCallback((assignmentId) => {
    if (assignmentId === selectedId) return;
    setSelectedId(assignmentId);
    setMessage('');
  }, [selectedId]);

  const handleClaimGroup = async () => {
    setClaiming(true);
    setError('');
    try {
      await api.claimImageGroup(groupId);
      const userId = getUserId(user);
      setWorkspace((prev) => {
        if (!prev) return prev;
        const nextImages = prev.images.map((img) =>
          img.status === 'available'
            ? {
                ...img,
                status: 'assigned',
                assignedTo: { _id: userId, name: user?.name },
              }
            : img
        );
        const available = nextImages.filter((row) => row.status === 'available').length;
        const mine = nextImages.filter(
          (row) => row.status !== 'available' && isAssignedToUser(row.assignedTo, user)
        );
        return {
          ...prev,
          images: nextImages,
          access: { canClaim: available > 0, canLabel: true },
          stats: { ...prev.stats, available, mine: mine.length },
        };
      });
      setMessage('Project claimed — start marking (drafts save locally)');
      setSelectedId((prev) => prev || images[0]?._id || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  const allFramesComplete = useMemo(() => {
    if (!labelableIds.size) return false;
    return [...labelableIds].every(
      (id) => countMarkedKeypoints(keypointsById[id]?.keypoints) >= IMAGE_KEYPOINT_LABEL_IDS.length
    );
  }, [labelableIds, keypointsById]);

  const handleSubmitProject = async () => {
    if (!allFramesComplete) {
      setError('Mark all points on every frame before submitting');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const submissions = [...labelableIds].map((assignmentId) => {
        const image = images.find((row) => row._id === assignmentId);
        const dims = dimensionsRef.current[assignmentId] || {};
        const entry = keypointsByIdRef.current[assignmentId];
        return {
          assignmentId,
          keypointsList: keypointsMapToList(entry?.keypoints),
          width: dims.width || image?.width || null,
          height: dims.height || image?.height || null,
        };
      });

      await api.submitImageGroup(groupId, { submissions });

      const nextCache = { ...keypointsByIdRef.current };
      let downloadIndex = 0;
      for (const assignmentId of labelableIds) {
        nextCache[assignmentId] = {
          ...nextCache[assignmentId],
          status: 'submitted',
        };
        const image = images.find((row) => row._id === assignmentId);
        const payload = buildKeypointExportPayload(
          image,
          nextCache[assignmentId].keypoints,
          dimensionsRef.current[assignmentId] || {}
        );
        window.setTimeout(() => {
          downloadJsonFile(payload, getKeypointExportFilename(image.imageId));
        }, downloadIndex * 250);
        downloadIndex += 1;
      }

      keypointsByIdRef.current = nextCache;
      setKeypointsById(nextCache);
      clearImageKeypointDraft(groupId, user);
      setWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          images: prev.images.map((row) =>
            labelableIds.has(row._id)
              ? {
                  ...row,
                  status: 'submitted',
                  submissionStatus: 'submitted',
                  isComplete: true,
                  markedCount: IMAGE_KEYPOINT_LABEL_IDS.length,
                }
              : row
          ),
          stats: {
            ...prev.stats,
            submitted: labelableIds.size,
            complete: labelableIds.size,
          },
        };
      });
      setMessage(`Submitted ${labelableIds.size} frames and downloaded JSON files`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const moveSelection = useCallback(
    (delta) => {
      const index = images.findIndex((row) => row._id === selectedId);
      if (index < 0) return;
      const next = images[index + delta];
      if (next) handleSelectImage(next._id);
    },
    [images, selectedId, handleSelectImage]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target.closest('input, textarea, select, button')) return;
      const key = event.key.toLowerCase();
      if (key === 'p') {
        setActiveLabel('pitch');
        return;
      }
      if (/^[0-8]$/.test(key)) {
        setActiveLabel(`kp${key}`);
        return;
      }
      if (key === 'a') {
        event.preventDefault();
        moveSelection(-1);
        return;
      }
      if (key === 'd') {
        event.preventDefault();
        moveSelection(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveSelection]);

  const handleImageDimensions = useCallback((assignmentId, dims) => {
    dimensionsRef.current[assignmentId] = dims;
  }, []);

  if (loading) return <div className="loading">Loading project…</div>;

  if (!workspace) {
    return (
      <div>
        <div className="alert alert-error">{error || 'Project not found'}</div>
        <Link to="/image-assignments" className="btn btn-secondary">
          Back to projects
        </Link>
      </div>
    );
  }

  const stats = workspace.stats || {};
  const completeCount = [...labelableIds].filter(
    (id) => countMarkedKeypoints(keypointsById[id]?.keypoints) >= IMAGE_KEYPOINT_LABEL_IDS.length
  ).length;

  return (
    <div className="image-group-page image-group-page--immersive">
      <div className="image-group-toolbar">
        <div className="image-group-toolbar-main">
          <Link to="/image-assignments" className="btn btn-secondary btn-sm">
            Projects
          </Link>
          <div>
            <strong>{workspace.group?.name || 'Image project'}</strong>
            <span className="text-muted image-group-toolbar-meta">
              {completeCount}/{labelableIds.size || stats.total || 0} frames ready
              {draftSaved && !projectSubmitted ? ' · draft saved locally' : ''}
            </span>
          </div>
        </div>
        <div className="page-header-actions">
          {workspace.access?.canClaim && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={claiming}
              onClick={handleClaimGroup}
            >
              {claiming ? 'Claiming…' : 'Claim project'}
            </button>
          )}
          {!projectSubmitted && labelableIds.size > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={submitting || !allFramesComplete}
              onClick={handleSubmitProject}
            >
              {submitting ? 'Submitting…' : 'Submit project'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {workspace.access?.canClaim && !workspace.access?.canLabel && (
        <div className="alert alert-info">
          Claim this project to mark keypoints. Drafts are stored in your browser until you submit.
        </div>
      )}

      <div className="image-group-workspace image-group-workspace--immersive">
        <ImageGroupGallery
          images={images}
          selectedId={selectedId}
          onSelect={handleSelectImage}
          labelableIds={labelableIds}
        />

        <div className="image-group-main">
          <div className="image-group-canvas image-group-canvas--immersive">
            {images.length > 0 ? (
              <>
                <div className="image-group-canvas-header">
                  <strong>{selectedImage?.title || selectedImage?.imageId || 'Select a frame'}</strong>
                  {!canLabelSelected && selectedImage && (
                    <span className="text-muted">View only — claim project to mark</span>
                  )}
                  {canLabelSelected && !readOnly && (
                    <span className="text-muted">Circular magnifier follows cursor while marking</span>
                  )}
                </div>
                <ImageGroupCanvasStack
                  images={images}
                  selectedId={selectedId}
                  keypointsById={keypointsById}
                  activeLabel={activeLabel}
                  showMagnifier={canLabelSelected && !readOnly}
                  onPlacePoint={(label, point) => {
                    if (readOnly) return;
                    updateKeypoints((prev) => ({ ...prev, [label]: point }));
                    setActiveLabel(label);
                  }}
                  onDragPoint={(label, point) => {
                    if (readOnly) return;
                    updateKeypoints((prev) => ({ ...prev, [label]: point }));
                  }}
                  onImageDimensions={handleImageDimensions}
                />
              </>
            ) : (
              <div className="empty-state">No frames in this project</div>
            )}
          </div>
        </div>

        <ImageKeypointMarkPanel
          keypoints={keypoints}
          activeLabel={activeLabel}
          onSelectLabel={setActiveLabel}
          onClearLabel={(label) => updateKeypoints((prev) => ({ ...prev, [label]: null }))}
          readOnly={readOnly}
          draftSaved={draftSaved}
          projectSubmitted={projectSubmitted}
          allFramesComplete={allFramesComplete}
          completeCount={completeCount}
          totalLabelable={labelableIds.size}
          imageTitle={selectedImage?.title || selectedImage?.imageId || ''}
        />
      </div>
    </div>
  );
}
