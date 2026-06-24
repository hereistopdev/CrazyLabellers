const LabelSubmission = require('../models/LabelSubmission');
const VideoAssignment = require('../models/VideoAssignment');
const { exportAnnotation, getExportFilename, resolveExportBasename } = require('../utils/exportAnnotation');

async function buildSubmissionExport(submissionId, variant = 'post') {
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
  const payload = exportAnnotation(submission.events, {
    gameTime: assignment.gameTime || '1 - 00:00',
    variant: exportVariant,
  });
  const filename = getExportFilename(exportBasename, exportVariant);

  return { payload, filename, submission, assignment };
}

function sendSubmissionExport(res, { payload, filename }) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(JSON.stringify(payload, null, 2));
}

module.exports = { buildSubmissionExport, sendSubmissionExport };
