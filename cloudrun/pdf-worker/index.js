const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const { Storage } = require('@google-cloud/storage');

// Simple worker: POST /render-pdf
// Body: { html: string, bucket: string, keyPrefix: string }
// Returns: { pdfKey, pdfUrl }

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const storage = new Storage();

app.post('/render-pdf', async (req, res) => {
  try {
    const { html, bucket, keyPrefix } = req.body;
    if (!html || !bucket || !keyPrefix) return res.status(400).json({ error: 'html, bucket and keyPrefix required' });

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    const key = `${keyPrefix}.pdf`;
    const file = storage.bucket(bucket).file(key);
    await file.save(pdfBuffer, { contentType: 'application/pdf' });
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 3600 * 1000 });
    res.json({ pdfKey: key, pdfUrl: url });
  } catch (err) {
    console.error('render-pdf error', err);
    res.status(500).json({ error: String(err) });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log('PDF worker listening on', port));
