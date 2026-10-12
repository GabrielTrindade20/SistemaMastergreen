import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';

// No build tools may be imported here: this module also runs in the slim image.
export function log(message: string, source = 'express') {
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  });
  console.log(`${time} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const directory = path.resolve(import.meta.dirname, 'public');
  if (!fs.existsSync(directory)) throw new Error('Run the client build before starting the server.');
  app.use(express.static(directory));
  app.use('*', (_req, res) => res.sendFile(path.resolve(directory, 'index.html')));
}
