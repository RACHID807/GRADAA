const fs = require('fs');
const path = require('path');

const found = new Set();
const regex = /[Ãðâ][\x80-\uFFFF]*/g; // looking for high characters starting with Ã, ð or â

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchDir(fullPath);
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      let m;
      while ((m = regex.exec(content)) !== null) {
        // limit length to capture the corrupted char combo
        found.add(m[0].substring(0, 10)); 
      }
    }
  }
}

searchDir(path.join(__dirname, 'public'));

for (let str of found) {
  let hex = Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
  console.log(`${str} -> ${hex}`);
}
