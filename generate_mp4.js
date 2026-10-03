const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const express = require('express');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const PORT = 3000;
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1280,720']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const recorder = new PuppeteerScreenRecorder(page, {
      fps: 30,
      videoFrame: { width: 1280, height: 720 },
      recordDurationLimit: 75
    });

    await page.goto(`http://localhost:${PORT}/promo-video.html`, { waitUntil: 'networkidle0' });
    
    // Attendre que la police se charge
    await page.evaluate(() => document.fonts.ready);

    // Hide controls
    await page.evaluate(() => {
      const controls = document.querySelector('.controls');
      if (controls) controls.style.display = 'none';
    });

    const savePath = './video_temp.mp4';
    await recorder.start(savePath);
    console.log('Recording started...');

    // Trigger video start
    await page.evaluate(() => {
      // Find the start button and click it to trigger animations and video sequence
      const btn = document.getElementById('btn-start');
      if(btn) btn.click();
      else window.startVideo && window.startVideo();
    });

    // Wait exactly 68 seconds for the video to finish
    await new Promise(r => setTimeout(r, 68000));

    await recorder.stop();
    console.log('Recording stopped.');
    await browser.close();

    // Mux with audio using Python's ffmpeg (since ffmpeg is not in PATH)
    console.log('Merging audio and video...');
    const pythonScript = `
import imageio_ffmpeg
import subprocess

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
cmd = [
    ffmpeg, "-y",
    "-i", "video_temp.mp4",
    "-i", "public/audio/audio.ogg",
    "-stream_loop", "-1", "-i", "public/audio/adhan.mp3",
    "-filter_complex", "[2:a]volume=0.2[a2];[1:a][a2]amix=inputs=2:duration=first:dropout_transition=2[a]",
    "-map", "0:v:0",
    "-map", "[a]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    "public/video/GRADAA-2026-Video-Officielle.mp4"
]
subprocess.run(cmd)
`;
    fs.writeFileSync('merge.py', pythonScript);
    execSync('python merge.py');
    console.log('Done! Final video is at public/video/GRADAA-2026-Video-Officielle.mp4');

    // Clean up
    fs.unlinkSync(savePath);
    fs.unlinkSync('merge.py');

  } catch (err) {
    console.error(err);
  } finally {
    server.close();
    process.exit(0);
  }
});
