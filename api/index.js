// Vercel serverless function entry point
const express = require('express');
const path = require('path');

// For production, we'll use the built Express app
let app;

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Import the built server dynamically
    if (!app) {
      const serverPath = path.join(process.cwd(), 'dist', 'index.js');
      const module = await import(serverPath);
      app = module.default || module;
    }

    // Handle the request with Express
    app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};