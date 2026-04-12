import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import Tesseract from "tesseract.js";
import Jimp from "jimp";

import { analyzeFintech } from "../src/lib/fintechAnalysis";

const app = express();

async function startServer() {
  const PORT = 3000;

  // Configure multer for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });

  // Logging middleware - MUST BE FIRST
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post("/api/analyze/image", upload.single("image"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image uploaded" });
      
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are supported for this module." });
      }

      const buffer = req.file.buffer;
      
      let image;
      try {
        image = await Jimp.read(buffer);
      } catch (e) {
        return res.status(400).json({ error: "Failed to read image. Please ensure it is a valid PNG or JPG file." });
      }
      
      const resized = image.resize(256, 256);
      const { width, height } = image.bitmap;

      // Simple Frequency Analysis (FFT-like simulation)
      // We analyze pixel variance in small blocks to detect "abnormal" patterns
      let variance = 0;
      resized.scan(0, 0, resized.bitmap.width, resized.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        const avg = (r + g + b) / 3;
        variance += Math.abs(avg - 128);
      });
      
      const frequencyScore = Math.min(1, variance / (256 * 256 * 64));

      res.json({
        success: true,
        features: {
          frequencyScore,
          dimensions: { width, height },
          mimeType: req.file.mimetype,
        }
      });
    } catch (error) {
      console.error("Image analysis error:", error);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  app.post("/api/analyze/document", upload.single("document"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No document uploaded" });
      
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "PDF documents are not supported yet. Please upload an image of the document (PNG/JPG)." });
      }

      const buffer = req.file.buffer;
      
      // OCR Analysis
      const { data: { text, confidence } } = await Tesseract.recognize(buffer, 'eng');

      // Check for common forgery signs in text
      const suspiciousKeywords = ["sample", "void", "copy", "specimen"];
      const foundKeywords = suspiciousKeywords.filter(kw => text.toLowerCase().includes(kw));

      res.json({
        success: true,
        features: {
          text: text.substring(0, 500), // Return snippet
          ocrConfidence: confidence / 100,
          suspiciousKeywords: foundKeywords,
          isLowConfidence: confidence < 70
        }
      });
    } catch (error) {
      console.error("Document analysis error:", error);
      res.status(500).json({ error: "Failed to analyze document" });
    }
  });

  app.post("/api/analyze/payment", upload.single("payment"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No payment proof uploaded" });
      
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Only image screenshots are supported for payment verification." });
      }

      const buffer = req.file.buffer;
      const { data: { text } } = await Tesseract.recognize(buffer, 'eng');

      // Use the improved fintech analysis logic
      const analysis = analyzeFintech(text);

      res.json({
        success: true,
        result: analysis.result,
        confidence_score: analysis.confidence_score,
        explanation: analysis.explanation,
        features: analysis.features
      });
    } catch (error) {
      console.error("Payment analysis error:", error);
      res.status(500).json({ error: "Failed to analyze payment proof" });
    }
  });

  // Catch-all for unmatched API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global error handler:", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      path: req.url 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
