import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Create Express app
const app = express();

// Configure middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Initialize routes
let routesInitialized = false;
async function initializeRoutes() {
  if (!routesInitialized) {
    await registerRoutes(app);
    routesInitialized = true;
  }
}

// Export serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize routes on first request
    await initializeRoutes();
    
    // Convert Vercel request/response to Express format and handle
    return app(req as any, res as any);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}