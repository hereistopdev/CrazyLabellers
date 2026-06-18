require('dotenv').config();
const { connectDB, disconnectDB } = require('../db/connect');
const { previewBulkFolder, importBulkFromFolder } = require('../services/bulkFolderImport');

function parseArgs(argv) {
  const args = {
    sourceDir: null,
    batchSize: 50,
    uploadVideos: true,
    importReferences: true,
    skipExisting: true,
    skipExistingVideos: true,
    kind: 'production',
    taskPrice: undefined,
    previewOnly: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--preview') {
      args.previewOnly = true;
    } else if (arg === '--no-upload-videos') {
      args.uploadVideos = false;
    } else if (arg === '--no-import-refs') {
      args.importReferences = false;
    } else if (arg === '--no-skip-existing') {
      args.skipExisting = false;
    } else if (arg === '--force-upload') {
      args.skipExistingVideos = false;
    } else if (arg.startsWith('--batch-size=')) {
      args.batchSize = parseInt(arg.split('=')[1], 10) || 50;
    } else if (arg.startsWith('--kind=')) {
      args.kind = arg.split('=')[1];
    } else if (arg.startsWith('--task-price=')) {
      args.taskPrice = parseFloat(arg.split('=')[1]);
    } else if (!arg.startsWith('--') && !args.sourceDir) {
      args.sourceDir = arg;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.sourceDir) {
    console.error(
      'Usage: node src/scripts/importBulkFolder.js <folder> [--preview] [--batch-size=50] [--kind=production] [--no-upload-videos] [--no-import-refs]'
    );
    process.exit(1);
  }

  await connectDB();

  if (args.previewOnly) {
    const preview = await previewBulkFolder(args.sourceDir);
    console.log(JSON.stringify(preview, null, 2));
    await disconnectDB();
    return;
  }

  let offset = 0;
  let done = false;
  let totals = {
    created: 0,
    skipped: 0,
    videosUploaded: 0,
    referencesImported: 0,
    errors: 0,
  };

  while (!done) {
    const result = await importBulkFromFolder({
      sourceDir: args.sourceDir,
      offset,
      limit: args.batchSize,
      uploadVideos: args.uploadVideos,
      importReferences: args.importReferences,
      skipExisting: args.skipExisting,
      skipExistingVideos: args.skipExistingVideos,
      kind: args.kind,
      taskPrice: args.taskPrice,
    });

    totals.created += result.created;
    totals.skipped += result.skipped;
    totals.videosUploaded += result.videosUploaded;
    totals.referencesImported += result.referencesImported;
    totals.errors += result.errors.length;

    console.log(
      `Batch ${offset}-${offset + result.processed}/${result.totalClips}: created ${result.created}, skipped ${result.skipped}, videos ${result.videosUploaded}, refs ${result.referencesImported}, errors ${result.errors.length}`
    );

    if (result.errors.length) {
      result.errors.slice(0, 5).forEach((err) => {
        console.error(`  ${err.clipId}: ${err.message}`);
      });
    }

    done = result.done;
    offset = result.nextOffset ?? offset + result.processed;
  }

  console.log('Bulk import complete:', totals);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Bulk import failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
