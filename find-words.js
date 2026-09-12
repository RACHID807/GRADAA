const fs = require('fs');
const path = require('path');

const found = new Set();
// match words that contain at least one of these weird chars
const regex = /\S*[Ãðâ]\S*/g;

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchDir(fullPath);
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      let m;
      while ((m = regex.exec(content)) !== null) {
        found.add(m[0]);
      }
    }
  }
}

searchDir(path.join(__dirname, 'public'));
searchDir(path.join(__dirname, 'functions', 'src'));

for (let str of found) {
  console.log(str);
}
