
/* Simple ABI export into the app */
const fs = require('fs');
const path = require('path');

const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts');
const outDir = path.join(__dirname, '..', '..', 'app', 'src', 'abi');
fs.mkdirSync(outDir, { recursive: true });

function copyAbi(name, file) {
  const artifact = require(path.join(artifactsPath, name, file + '.json'));
  const abi = artifact.abi;
  fs.writeFileSync(path.join(outDir, file + '.json'), JSON.stringify(abi, null, 2));
  console.log('Exported ABI', file);
}

copyAbi('CourseManager.sol', 'CourseManager');
