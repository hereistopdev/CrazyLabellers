const LabelSubmission = require('../models/LabelSubmission');
const VideoAssignment = require('../models/VideoAssignment');
const {
  exportAnnotation,
  getExportFilename,
  resolveExportBasename,
  isValidClipId,
} = require('../utils/exportAnnotation');
const { loadReferenceForClip } = require('./referenceStorage');

function getReferenceDownloadFilename(clipId, variant = 'post') {
  if (!isValidClipId(clipId)) {
    throw new Error('Invalid clip ID');
  }
  return variant === 'post' ? `${clipId}_reference_post.json` : `${clipId}_reference.json`;
}

function getSubmissionDownloadFilename(clipId, variant = 'post') {
  return getExportFilename(clipId, variant);
}

async function buildReferenceExportForSubmission(submissionId, variant = 'post') {
  const submission = await LabelSubmission.findById(submissionId);
  if (!submission) {
    const error = new Error('Submission not found');
    error.status = 404;
    throw error;
  }

  const assignment = await VideoAssignment.findById(submission.assignmentId);
  const exportBasename = resolveExportBasename(assignment);
  if (!exportBasename) {
    const error = new Error('Assignment has no title or clip ID for export');
    error.status = 400;
    throw error;
  }

  const exportVariant = variant === 'raw' ? 'raw' : 'post';
  const reference = await loadReferenceForClip(assignment.clipId || exportBasename, exportVariant);
  if (!reference.hasReference || !reference.events?.length) {
    const error = new Error('No reference annotations for this clip');
    error.status = 404;
    throw error;
  }

  const payload = exportAnnotation(reference.events, {
    gameTime: assignment.gameTime || '1 - 00:00',
    variant: exportVariant,
  });
  const filename = getReferenceDownloadFilename(exportBasename, exportVariant);

  return { payload, filename, submission, assignment, reference };
}

module.exports = {
  getReferenceDownloadFilename,
  getSubmissionDownloadFilename,
  buildReferenceExportForSubmission,
};
