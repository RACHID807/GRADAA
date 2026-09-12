const fs = require('fs');
const path = require('path');

const replacements = {
  "ðŸ”’": "🔒",
  "ðŸ“Š": "📊",
  "ðŸ‘¥": "👥",
  "ðŸ“ˆ": "📈",
  "ðŸ“¦": "📦",
  "ðŸ” ": "🔍",
  "âœ…": "✅",
  "â ³": "⏳",
  "PrÃ©sents": "Présents",
  "non arrivÃ©s": "non arrivés",
  "Non arrivÃ©s": "Non arrivés",
  "rÃ©sultat": "résultat",
  "0â€“0": "0–0",
  "PrÃ©c.": "Préc.",
  "â†": "←",
  "ðŸ™ˆ": "🙈",
  "â Œ": "❌",
  "â€¦": "…",
  "â”€": "─",
  "â˜°": "☰",
  "ðŸ“§": "📧",
  "ðŸ ˜ï¸ ": "🏟️",
  "ðŸ• ": "🕐",
  "ðŸ“‹": "📋",
  "â¬‡ï¸ ": "⬇️",
  "ðŸ–¨ï¸ ": "🖨️",
  "ðŸ”„": "🔄",
  "âœ“": "✓",
  "ðŸ“¬": "📬",
  "ðŸ“ ": "📍",
  "accÃ¨s": "accès",
  "d'accÃ¨s": "d'accès",
  "RÃ©partition": "Répartition",
  "Ã©volution": "évolution",
  "TÃ©lÃ©charger": "Télécharger",
  "ðŸ‘ ": "👁",
  "ðŸ”“": "🔓",
  "â€¢": "•",
  "Ã©": "é",
  "Ã¨": "è",
  "Ãª": "ê",
  "Ã¢": "â",
  "Ã®": "î",
  "Ã´": "ô",
  "Ã§": "ç",
  "Ã\u00A0": "à",
  "Ã ": "à"
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
      if (file !== 'node_modules' && file !== '.git') {
        processDir(fullPath);
      }
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
console.log("Done fixing all");
