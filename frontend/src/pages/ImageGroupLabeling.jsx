import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { canUseLabeler } from '../utils/labelerAccess';
import { isAdmin } from '../utils/roles';
import { isAssignedToUser } from '../utils/userId';
import ImageGroupCanvasStack from '../components/ImageGroupCanvasStack';
import { MAGNIFIER_ZOOM_LEVELS } from '../components/ImageKeypointCanvas';
import ImageKeypointMarkPanel from '../components/ImageKeypointMarkPanel';
import ImageGroupGallery from '../components/ImageGroupGallery';
import {
  IMAGE_KEYPOINT_LABEL_IDS,
  emptyKeypointsMap,
  countMarkedKeypoints,
  countLabellerExportKeypoints,
  keypointsMapToList,
  getKeypointLabelMeta,
  labelIdFromHotkey,
  formatKeypointCoords,
} from '../config/imageKeypoints';
import {
  loadImageKeypointDraft,
  saveImageKeypointDraft,
  clearImageKeypointDraft,
  mergeDraftIntoCache,
  cacheToDraftPayload,
} from '../utils/imageKeypointDraftStorage';
import {
  predictLabelInRange,
} from '../utils/imageKeypointAutoMark';
import {
  isArrowKey,
  arrowNudgeStep,
  arrowNudgeDelta,
  nudgeNormalizedPoint,
} from '../utils/imageKeypointNudge';
import { IMAGE_KEYPOINT_HOTKEYS } from '../config/imageKeypointHotkeys';

function pickInitialImageId(images, user, requestedId) {
  const requested = requestedId ? String(requestedId) : '';
  if (requested) {
    const byAssignmentId = images.find((row) => String(row._id) === requested);
    if (byAssignmentId) return String(byAssignmentId._id);
    const byImageId = images.find((row) => String(row.imageId) === requested);
    if (byImageId) return String(byImageId._id);
  }
  const firstMine = images.find(
    (row) => row.status !== 'available' && isAssignedToUser(row.assignedTo, user)
  );
  return String(firstMine?._id || images[0]?._id || '');
}

function syncGalleryProgress(images, keypointsById) {
  return images.map((row) => {
    const entry = keypointsById[String(row._id)] || keypointsById[row._id];
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
  const { user, loading: authLoading } = useAuth();
  const keypointsByIdRef = useRef({});
  const initialImageRef = useRef(searchParams.get('image'));
  const dimensionsRef = useRef({});
  const syncedImageParamRef = useRef('');
  const workspaceLoadedRef = useRef(false);

  const [workspace, setWorkspace] = useState(null);
  const [keypointsById, setKeypointsById] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [activeLabel, setActiveLabel] = useState('pitch');
  const [magnifierZoom, setMagnifierZoom] = useState(3);
  const [loading, setLoading] = useState(true);
  const [draftSaved, setDraftSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [imageDimensionsById, setImageDimensionsById] = useState({});

  const images = useMemo(
    () => syncGalleryProgress(workspace?.images || [], keypointsById),
    [workspace?.images, keypointsById]
  );

  const selectedImage = useMemo(
    () => images.find((row) => String(row._id) === String(selectedId)) || null,
    [images, selectedId]
  );

  const labelableIds = useMemo(() => {
    if (isAdmin(user)) return new Set(images.map((row) => String(row._id)));
    return new Set(
      images
        .filter((row) => row.status !== 'available' && isAssignedToUser(row.assignedTo, user))
        .map((row) => String(row._id))
    );
  }, [images, user]);

  const selectedKey = selectedId ? String(selectedId) : '';

  const currentEntry = keypointsById[selectedKey] || {
    keypoints: emptyKeypointsMap(),
    status: 'draft',
  };
  const keypoints = currentEntry.keypoints || emptyKeypointsMap();
  const submissionStatus = currentEntry.status;

  const canLabelSelected = selectedKey && labelableIds.has(selectedKey);
  const readOnly =
    !canLabelSelected || submissionStatus === 'submitted' || submissionStatus === 'approved';

  const projectLocked = useMemo(
    () =>
      labelableIds.size > 0 &&
      [...labelableIds].every(
        (id) => keypointsById[id]?.status === 'submitted' || keypointsById[id]?.status === 'approved'
      ),
    [labelableIds, keypointsById]
  );

  const hasRejectedFrames = useMemo(
    () => [...labelableIds].some((id) => keypointsById[id]?.status === 'rejected'),
    [labelableIds, keypointsById]
  );

  const hasExportableWork = useMemo(
    () =>
      [...labelableIds].some(
        (id) => countLabellerExportKeypoints(keypointsById[id]?.keypoints) > 0
      ),
    [labelableIds, keypointsById]
  );

  const hasMarkedWork = useMemo(
    () =>
      [...labelableIds].some(
        (id) => countMarkedKeypoints(keypointsById[id]?.keypoints) > 0
      ),
    [labelableIds, keypointsById]
  );

  const applyWorkspace = useCallback(
    (data) => {
      if (!data) return;
      const draft = loadImageKeypointDraft(groupId, user);
      const cache = mergeDraftIntoCache(data.images, draft);
      keypointsByIdRef.current = cache;
      setKeypointsById(cache);
      setWorkspace(data);
      setSelectedId(pickInitialImageId(data.images, user, initialImageRef.current));
    },
    [groupId, user]
  );

  const loadWorkspace = useCallback(async () => {
    const isRefresh = workspaceLoadedRef.current;
    if (!isRefresh) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await api.getImageGroupWorkspace(groupId);
      applyWorkspace(data);
      workspaceLoadedRef.current = true;
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  }, [groupId, applyWorkspace]);

  useEffect(() => {
    workspaceLoadedRef.current = false;
    syncedImageParamRef.current = '';
  }, [groupId]);

  useEffect(() => {
    if (authLoading) return;
    if (!canUseLabeler(user)) {
      navigate('/');
      return;
    }
    loadWorkspace();
  }, [authLoading, groupId, navigate, loadWorkspace, user?._id, user?.role]);

  useEffect(() => {
    if (!images.length) return;
    if (!images.some((row) => String(row._id) === String(selectedId))) {
      setSelectedId(String(images[0]._id));
    }
  }, [images, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (syncedImageParamRef.current === selectedId) return;
    syncedImageParamRef.current = selectedId;
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
      const id = String(assignmentId);
      setKeypointsById((prev) => {
        const next = {
          ...prev,
          [id]: {
            keypoints: map,
            status: status ?? prev[id]?.status ?? 'draft',
            reviewerNotes: prev[id]?.reviewerNotes ?? '',
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
      if (!selectedKey || readOnly) return;
      const prev = keypointsByIdRef.current[selectedKey]?.keypoints || emptyKeypointsMap();
      const next = typeof updater === 'function' ? updater(prev) : updater;
      updateKeypointsCache(selectedKey, next);
    },
    [selectedKey, readOnly, updateKeypointsCache]
  );

  const handleRangeAutoMark = useCallback(
    ({ referenceFrom, referenceTo, targetFrom, targetTo, label }) => {
      if (readOnly) return;
      const result = predictLabelInRange({
        images,
        keypointsById: keypointsByIdRef.current,
        label,
        referenceFrom,
        referenceTo,
        targetFrom,
        targetTo,
        labelableIds,
      });

      if (result.error) {
        setMessage(result.error);
        return;
      }

      setKeypointsById((prev) => {
        const next = { ...prev };
        for (const [assignmentId, labelPoints] of Object.entries(result.updates)) {
          const existing = next[assignmentId]?.keypoints || emptyKeypointsMap();
          next[assignmentId] = {
            ...next[assignmentId],
            keypoints: { ...existing, ...labelPoints },
            status: next[assignmentId]?.status ?? 'draft',
          };
        }
        keypointsByIdRef.current = next;
        persistLocalDraft(next);
        return next;
      });

      const labelText = label === 'all' ? `${result.labelCount} points` : label;
      setMessage(
        `Auto-marked ${labelText} on ${result.frameCount} frame${result.frameCount === 1 ? '' : 's'}`
      );
    },
    [images, labelableIds, persistLocalDraft, readOnly]
  );

  const selectedFrame = useMemo(() => {
    const index = images.findIndex((row) => String(row._id) === selectedKey);
    return index >= 0 ? index + 1 : 1;
  }, [images, selectedKey]);

  const handleSelectImage = useCallback((assignmentId) => {
    const nextId = String(assignmentId);
    if (nextId === selectedKey) return;
    setSelectedId(nextId);
    setMessage('');
  }, [selectedKey]);

  const usesReferenceDraft = useMemo(
    () => images.some((row) => row.allowLabellerReference && row.hasReference),
    [images]
  );

  const handleClaimGroup = async () => {
    setClaiming(true);
    setError('');
    try {
      await api.claimImageGroup(groupId);
      const data = await loadWorkspace();
      const hasSharedReference = (data?.images || []).some(
        (row) => row.allowLabellerReference && row.hasReference && row.markedCount > 0
      );
      setMessage(
        hasSharedReference
          ? 'Project claimed — reference keypoints loaded as your starting draft'
          : 'Project claimed — start marking (drafts save locally)'
      );
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

  const buildSubmissionsPayload = useCallback(
    () =>
      [...labelableIds].map((assignmentId) => {
        const image = images.find((row) => String(row._id) === String(assignmentId));
        const dims = dimensionsRef.current[assignmentId] || {};
        const entry = keypointsByIdRef.current[assignmentId];
        return {
          assignmentId,
          keypointsList: keypointsMapToList(entry?.keypoints),
          width: dims.width || image?.width || null,
          height: dims.height || image?.height || null,
        };
      }),
    [labelableIds, images]
  );

  const handleSaveDraft = async () => {
    if (!hasMarkedWork || projectLocked) return;

    setSavingDraft(true);
    setError('');
    setMessage('');
    try {
      const result = await api.saveImageGroupDraft(groupId, {
        submissions: buildSubmissionsPayload(),
      });

      setKeypointsById((prev) => {
        const next = { ...prev };
        for (const assignmentId of labelableIds) {
          if (countMarkedKeypoints(next[assignmentId]?.keypoints) > 0) {
            next[assignmentId] = {
              ...next[assignmentId],
              status: 'draft',
            };
          }
        }
        keypointsByIdRef.current = next;
        persistLocalDraft(next);
        return next;
      });
      setMessage(result.message || 'Draft saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitFinal = async () => {
    if (!allFramesComplete) {
      setError('Mark all points on every frame before final submit');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await api.submitImageGroup(groupId, {
        mode: 'final',
        submissions: buildSubmissionsPayload(),
      });

      const nextCache = { ...keypointsByIdRef.current };
      for (const assignmentId of labelableIds) {
        nextCache[assignmentId] = {
          ...nextCache[assignmentId],
          status: 'submitted',
          reviewerNotes: '',
        };
      }

      keypointsByIdRef.current = nextCache;
      setKeypointsById(nextCache);
      clearImageKeypointDraft(groupId, user);
      setWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          images: prev.images.map((row) =>
            labelableIds.has(String(row._id))
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
      setMessage(
        result.message ||
          `Final submission complete — use Download JSON for the full project export`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadGroup = async () => {
    setDownloading(true);
    setError('');
    try {
      if (projectLocked) {
        await api.exportImageGroup(groupId);
        setMessage('Downloaded project JSON zip');
      } else {
        await api.exportImageGroupDraft(groupId, {
          submissions: buildSubmissionsPayload(),
        });
        setMessage('Downloaded draft JSON zip');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const moveSelection = useCallback(
    (delta) => {
      const index = images.findIndex((row) => String(row._id) === selectedKey);
      if (index < 0) return;
      const next = images[index + delta];
      if (next) handleSelectImage(next._id);
    },
    [images, selectedKey, handleSelectImage]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target.closest('input, textarea, select')) return;

      const labelId = labelIdFromHotkey(event.key, event.code);
      if (labelId) {
        event.preventDefault();
        setActiveLabel(labelId);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (readOnly) return;
        const point = keypointsByIdRef.current[selectedKey]?.keypoints?.[activeLabel];
        if (!point) return;
        event.preventDefault();
        updateKeypoints((prev) => ({ ...prev, [activeLabel]: null }));
        return;
      }

      if (isArrowKey(event.key)) {
        if (readOnly) return;
        const point = keypointsByIdRef.current[selectedKey]?.keypoints?.[activeLabel];
        if (!point) return;
        const dims = dimensionsRef.current[selectedKey];
        const width = dims?.width;
        const height = dims?.height;
        if (!width || !height) return;
        const step = arrowNudgeStep(event);
        const delta = arrowNudgeDelta(event.key, step);
        if (!delta) return;
        event.preventDefault();
        updateKeypoints((prev) => ({
          ...prev,
          [activeLabel]: nudgeNormalizedPoint(prev[activeLabel], delta, width, height),
        }));
        return;
      }

      if (event.target.closest('button')) return;
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        moveSelection(-1);
        return;
      }
      if (event.key.toLowerCase() === 'd') {
        event.preventDefault();
        moveSelection(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveSelection, readOnly, activeLabel, selectedKey, updateKeypoints]);

  const handleImageDimensions = useCallback((assignmentId, dims) => {
    const id = String(assignmentId);
    const prev = dimensionsRef.current[id];
    if (prev?.width === dims.width && prev?.height === dims.height) return;
    dimensionsRef.current[id] = dims;
    setImageDimensionsById((prevState) => ({ ...prevState, [id]: dims }));
  }, []);

  if (authLoading || loading) return <div className="loading">Loading project…</div>;

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

  const activeLabelMeta = getKeypointLabelMeta(activeLabel);
  const activeLabelPlaced = Boolean(keypoints[activeLabel]);
  const activeLabelCoords = formatKeypointCoords(
    keypoints[activeLabel],
    imageDimensionsById[selectedKey]?.width || selectedImage?.width,
    imageDimensionsById[selectedKey]?.height || selectedImage?.height
  );

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
              {draftSaved && !projectLocked ? ' · draft saved locally' : ''}
              {hasRejectedFrames ? ' · rejected — fix and resubmit' : ''}
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
          {labelableIds.size > 0 && (projectLocked ? hasExportableWork : hasMarkedWork) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={downloading}
              onClick={handleDownloadGroup}
            >
              {downloading
                ? 'Downloading…'
                : projectLocked
                  ? 'Download JSON'
                  : 'Download draft JSON'}
            </button>
          )}
          {labelableIds.size > 0 && !projectLocked && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={savingDraft || !hasMarkedWork}
              onClick={handleSaveDraft}
            >
              {savingDraft ? 'Saving…' : 'Save draft'}
            </button>
          )}
          {labelableIds.size > 0 && !projectLocked && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={submitting || !allFramesComplete}
              onClick={handleSubmitFinal}
            >
              {submitting ? 'Submitting…' : hasRejectedFrames ? 'Resubmit final' : 'Submit final'}
            </button>
          )}
        </div>
      </div>

      <div className="image-group-hotkeys-bar">
        <span className="image-group-hotkeys-title">Hotkeys</span>
        <div className="image-group-hotkeys-list">
          {IMAGE_KEYPOINT_HOTKEYS.map((item) => (
            <span key={item.keys} className="image-group-hotkey-item">
              <kbd>{item.keys}</kbd>
              <span>{item.action}</span>
            </span>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {workspace.access?.canClaim && !workspace.access?.canLabel && (
        <div className="alert alert-info">
          Claim this project to mark keypoints.
          {usesReferenceDraft
            ? ' Shared reference JSON will load as your starting draft on each frame.'
            : ' Save drafts anytime, download draft JSON anytime, then submit final results when every frame is complete.'}
        </div>
      )}

      {labelableIds.size > 0 && usesReferenceDraft && !projectLocked && (
        <div className="alert alert-info">
          Reference keypoints are pre-filled as your draft. Adjust as needed, then save or submit.
        </div>
      )}

      {submissionStatus === 'rejected' && currentEntry.reviewerNotes && (
        <div className="alert alert-error">
          This frame was rejected: {currentEntry.reviewerNotes}
        </div>
      )}

      {projectLocked && (
        <div className="alert alert-info">
          Final submission sent — awaiting admin review. Download JSON anytime from the toolbar.
        </div>
      )}

      <div className="image-group-workspace image-group-workspace--immersive">
        <ImageGroupGallery
          images={images}
          selectedId={selectedKey}
          onSelect={handleSelectImage}
          labelableIds={labelableIds}
        />

        <div className="image-group-main">
          <div className="image-group-canvas image-group-canvas--immersive">
            {images.length > 0 ? (
              <>
                <div className="image-group-canvas-header">
                  <div className="image-group-canvas-header-row">
                    <strong>{selectedImage?.title || selectedImage?.imageId || 'Select a frame'}</strong>
                    {canLabelSelected && !readOnly && (
                      <div className="image-magnifier-zoom-bar">
                        <span className="image-magnifier-zoom-label">Magnifier</span>
                        {MAGNIFIER_ZOOM_LEVELS.map((level) => (
                          <button
                            key={level}
                            type="button"
                            className={`btn btn-sm${magnifierZoom === level ? ' btn-primary' : ' btn-secondary'}`}
                            onClick={() => setMagnifierZoom(level)}
                          >
                            {level}×
                          </button>
                        ))}
                      </div>
                    )}
                    {!canLabelSelected && selectedImage && (
                      <span className="text-muted">View only — claim project to mark</span>
                    )}
                  </div>
                  {activeLabelMeta && canLabelSelected && (
                    <div
                      className={`image-keypoint-active-banner${activeLabelPlaced ? ' placed' : ''}`}
                      style={{ '--banner-color': activeLabelMeta.color }}
                    >
                      <span className="image-keypoint-active-banner-swatch" aria-hidden />
                      <div className="image-keypoint-active-banner-text">
                        <strong>{activeLabelMeta.name}</strong>
                        <span>{activeLabelMeta.hint}</span>
                        {activeLabelPlaced && activeLabelCoords && (
                          <span className="image-keypoint-active-banner-coords">{activeLabelCoords}</span>
                        )}
                      </div>
                      <span className="image-keypoint-active-banner-status">
                        {activeLabelPlaced ? 'Marked — Delete to clear' : 'Click image to place'}
                      </span>
                    </div>
                  )}
                </div>
                <ImageGroupCanvasStack
                  images={images}
                  selectedId={selectedKey}
                  keypointsById={keypointsById}
                  activeLabel={activeLabel}
                  showMagnifier={canLabelSelected && !readOnly}
                  magnifierZoom={magnifierZoom}
                  onPlacePoint={(label, point) => {
                    if (readOnly) return;
                    updateKeypoints((prev) => ({ ...prev, [label]: point }));
                    setActiveLabel(label);
                  }}
                  onDragPoint={(label, point) => {
                    if (readOnly) return;
                    updateKeypoints((prev) => ({ ...prev, [label]: point }));
                  }}
                  onSelectLabel={setActiveLabel}
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
          projectLocked={projectLocked}
          completeCount={completeCount}
          totalLabelable={labelableIds.size}
          imageTitle={selectedImage?.title || selectedImage?.imageId || ''}
          frameCount={images.length}
          selectedFrame={selectedFrame}
          onRangeAutoMark={handleRangeAutoMark}
        />
      </div>
    </div>
  );
}
