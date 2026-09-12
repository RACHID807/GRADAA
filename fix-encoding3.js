const fs = require('fs');
const path = require('path');

const replacements = {
  "\u00f0\u0178\u2018\u0081": "👁", 
  "\u00e2\u009d\u0152": "❌",
  "\u00f0\u0178\u008f\u02dc\u00ef\u00b8\u008f": "🏟️",
  "\u00f0\u0178\u2022\u0090": "🕐",
  "\u00f0\u0178\u201d\u008d": "🔍",
  "\u00e2\u008f\u00b3": "⏳",
  "\u00e2\u00ac\u2021\u00ef\u00b8\u008f": "⬇️",
  "\u00f0\u0178\u2013\u00a8\u00ef\u00b8\u008f": "🖨️",
  "\u00f0\u0178\u201c\u009d": "📍",
  "\u00c3\u00a0": "à",
  "\u00c3\u00a9": "é",
  "\u00c3\u00aa": "ê",
  "\u00c3\u00a8": "è",
  "\u00c3\u00a7": "ç",
  "\u00c3\u00b4": "ô",
  "\u00c3\u00ae": "î",
  "\u00c3\u00a2": "â"
};

function fixEncoding(text) {
  let fixed = text;
  for (const [bad, good] of Object.entries(replacements)) {
    fixed = fixed.split(bad).join(good);
  }
  return fixed;
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js') || fullPath.endsWith('.css') || fullPath.endsWith('.json')) {
      const original = fs.readFileSync(fullPath, 'utf8');
      const fixed = fixEncoding(original);
      if (original !== fixed) {
        fs.writeFileSync(fullPath, fixed, 'utf8');
        console.log(`Fixed ${fullPath}`);
      }
    }
  }
}

processDir(path.join(__dirname, 'public'));
processDir(path.join(__dirname, 'functions', 'src'));
console.log("Done phase 3");
