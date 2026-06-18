const { terminologies } = require('./terminologyData');
const { testQuestions } = require('./knowledgeTestQuestions');

const sampleAssignments = [
  {
    title: 'Sample Clip 1 - Counter Attack',
    description: 'Practice labeling a counter-attack sequence (30 seconds)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    durationSeconds: 30,
    status: 'available',
  },
  {
    title: 'Sample Clip 2 - Set Piece',
    description: 'Practice labeling corner kick and aerial events',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    durationSeconds: 30,
    status: 'available',
  },
  {
    title: 'Sample Clip 3 - Build-up Play',
    description: 'Practice passes, take-ons, and shots',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    durationSeconds: 30,
    status: 'available',
  },
];

module.exports = { terminologies, testQuestions, sampleAssignments };
