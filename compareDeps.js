const fs = require('fs');
const child_process = require('child_process');

const depReg = /---\s([\w:\.-\d]+)/
const depReg2 = /---\s([\w:\.-\d]+:)[\.\d\w]+ -> ([\.\d\w]+)/
const depReg3 = /---\s([\w:\.-\d]+) -> ([\.\d\w]+)/

const GRADLE_BINARY = 'gradlew';

const header = "RESOLUTIONAPI_JSONDEPS_:"
function parseJsonDeps(fileName, opts) {
  const stdout = child_process.execSync(`${GRADLE_BINARY} -I ${fileName} jsonDeps --no-scan`, opts);
  const deps = new Set();
  stdout.toString().split('\n').forEach(l => {
    if (l.startsWith(header)) {
      const startJson = l.indexOf("_{");
      const json = JSON.parse(l.slice(startJson + 1));
      parseJson(deps, json);
    }
  });
  return deps;
}

function parseJson(deps, data) {
  data.resolvedProjectConfigurations.forEach(c => {
    console.log(c.resolvedConfigurationName)
    c.resolvedConfigurationDirectComponents.forEach(dc => {
      deps.add(`${dc.name}:${dc.version}`);
    });
    c.resolvedConfigurationDependencies.forEach(d => {
      d.resolvedComponentOutgoing.forEach(c => {
        deps.add(`${c.name}:${c.version}`)
      })
    });
  });
}

function parseGradle(opts) {
  const stdout = [
    child_process.execSync(`${GRADLE_BINARY} dependencies --no-scan`, opts),
    child_process.execSync(`${GRADLE_BINARY} sample-app:dependencies --no-scan`, opts),
    child_process.execSync(`${GRADLE_BINARY} sample-api:dependencies --no-scan`, opts),
  ];
  const gradleDeps = new Set();
  stdout.forEach(s =>
    s.toString().split('\n').forEach(l => {
      let fnd = l.match(depReg2);
      if (fnd) {
        gradleDeps.add(`${fnd[1]}${fnd[2]}`)
      } else if ((fnd = l.match(depReg3))) {
        gradleDeps.add(`${fnd[1]}:${fnd[2]}`);
      } else if ((fnd = l.match(depReg))) {
        gradleDeps.add(fnd[1])
      } else {
        console.log(l)
      }
    })
  );

  return gradleDeps;
}

function main() {
  if (process.argv.length < 3) {
    console.log(process.argv.length)
    console.log('compareDeps version deprecated');
    console.log(`            version = 'v6' or 'v8'`)
    console.log(`            deprecated (optional) - any value will ignore deprecated configurations`)
    return;
  }
  let filePath;
  switch (process.argv[2]) {
    case 'v8':
      filePath = 'v8';
      break;
    case 'v6':
      filePath = 'v6';
      break;
    default:
      console.error(`invalid version: ${process.argv[2]}, must be 'v6' or 'v8'`)
      return;
  }

  let fileName = process.argv[3] ? 'jsonDeps-deprecate.gradle' : 'jsonDeps.gradle';
  fileName = `${__dirname}/${fileName}`;
  const opts = { cwd: `${__dirname}/${filePath}`}
  console.log(opts);
  const gradleDeps = parseGradle(opts);
  const deps = parseJsonDeps(fileName, opts);
  deps.forEach(d => {
    if (gradleDeps.has(d)) {
      gradleDeps.delete(d);
      deps.delete(d);
    }
  });

  console.log('missing deps', deps);
  console.log('missing gradleDeps', gradleDeps)
  console.log('done');
}
main();
