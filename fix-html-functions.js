const fs = require('fs');
const path = require('path');
const htmlDir = path.join(__dirname, 'public');

fs.readdirSync(htmlDir).forEach(file => {
  if (file.endsWith('.html')) {
    let content = fs.readFileSync(path.join(htmlDir, file), 'utf8');
    if (!content.includes('firebase-functions-compat.js')) {
      content = content.replace(
        '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>',
        '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>\n  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js"></script>'
      );
      fs.writeFileSync(path.join(htmlDir, file), content);
      console.log('Updated ' + file);
    }
  }
});
