const fs = require('fs');
const path = require('path');

const replacements = {
  "ðŸ”’": "🔒",
  "â€¢": "•",
  "ðŸ‘ ": "👁",
  "ðŸ”“": "🔓",
  "ðŸ™ˆ": "🙈",
  "â Œ": "❌",
  "â€¦": "…",
  "â”€": "─",
  "â˜°": "☰",
  "ðŸ“§": "📧",
  "ðŸ“ˆ": "📈",
  "ðŸ ˜ï¸ ": "🏟️",
  "ðŸ ˜\uFE0F": "🏟️",
  "ðŸ• ": "🕐",
  "ðŸ” ": "🔍",
  "ðŸ“‹": "📋",
  "â ³": "⏳",
  "â¬‡ï¸ ": "⬇️",
  "â¬‡\uFE0F": "⬇️",
  "ðŸ–¨ï¸ ": "🖨️",
  "ðŸ–¨\uFE0F": "🖨️",
  "ðŸ”„": "🔄",
  "âœ“": "✓",
  "ðŸ“¬": "📬",
  "ðŸ“ ": "📍"
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
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
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
console.log("Done phase 2");
