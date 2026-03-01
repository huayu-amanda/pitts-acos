// Quick test for jstracing initialize
const path = require('path');
const fs = require('fs');

const JSTracing = require('./lib/jstracing/index.js');

const contentPackageId = 'jstracing-python';
const exerciseName = 'point_above_below';

const handlers = {
  contentPackages: {}
};

handlers.contentPackages[contentPackageId] = {
  meta: (function(){
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'jstracing-python', 'manifest.json'), 'utf8'));
    // lib/index.js normally converts files list into a contents map; emulate that for the test
    m.contents = m.contents || {};
    (m.files || []).forEach(f => {
      const name = f.name.replace(/\.json$/,'');
      m.contents[name] = { file: f.name };
    });
    return m;
  })(),
  dir: path.join(__dirname, 'jstracing-python')
};

const req = { params: { contentPackage: contentPackageId, name: exerciseName } };
const params = {};

JSTracing.initialize(req, params, handlers, () => {
  if (params.error) {
    console.error('Initialization reported error.');
    process.exit(2);
  }
  if (params.bodyContent) {
    console.log('Generated HTML length:', params.bodyContent.length);
    // Optionally write to tmp file for inspection
    const out = path.join(__dirname, 'test-output.html');
    fs.writeFileSync(out, params.bodyContent, 'utf8');
    console.log('Wrote', out);
    process.exit(0);
  } else {
    console.error('No bodyContent returned.');
    process.exit(1);
  }
});
