const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

const PORT = 3001;
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle0' });
    
    console.log('Resetting participantCount to 0...');
    
    await page.evaluate(async () => {
      const db = window.GRADAA.db;
      const eventId = window.GRADAA.EVENT_CONFIG.id;
      
      await db.collection('events').doc(eventId).set({ participantCount: 0 }, { merge: true });
    });
    
    console.log('Counter successfully reset to 0!');
    await browser.close();

  } catch (err) {
    console.error('Error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
