# CW Task Recorder (Club Wealth internal only)

Chrome / Edge extension for the Admin Hub's **Task Recording** feature. While a recording is on it takes a
screenshot of the browser tab for every click, typed field, copy, cut, paste, tab switch and page opened,
circles the click, and covers password and card fields. When you stop, you review the screenshots, delete
any you don't want, and press **Send to Claude**: the Admin Hub stores the recording, Claude writes the
detailed steps, a summary and the Flow Canvas JSON, and Miguel is notified.

Install: Admin Hub → Task Recording → Download the Task Recorder, unzip, then chrome://extensions →
Developer mode → Load unpacked → choose this folder.

Files: `background.js` (recording, screenshots, tab switches), `content.js` (clicks, typing, copy/paste,
Google Sheets cell and tab, countdown), `popup.*` (consent, start, pause, stop), `review.*` (review and send),
`config.js` (the hub's address; the hub rewrites it on download).
