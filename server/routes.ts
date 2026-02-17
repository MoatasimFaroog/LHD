import type { Express } from "express";
import { type Server } from "http";

interface PulseData {
  pulseId: string;
  sessionId: string;
  timestamp: string;
  totalCount: number;
  countsByLabel: { label: string; count: number }[];
  rowCount: number;
  deviceId: string;
  attemptCount: number;
  status: string;
}

const receivedPulses: PulseData[] = [];
const MAX_STORED_PULSES = 1000;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/pulse", (req, res) => {
    const pulse: PulseData = req.body;

    if (!pulse || !pulse.sessionId) {
      return res.status(400).json({
        success: false,
        error: "Invalid pulse data. sessionId is required."
      });
    }

    pulse.status = "received";
    receivedPulses.push(pulse);

    if (receivedPulses.length > MAX_STORED_PULSES) {
      receivedPulses.splice(0, receivedPulses.length - MAX_STORED_PULSES);
    }

    console.log(`[MockServer] Pulse received: ${pulse.pulseId || 'unknown'} | Session: ${pulse.sessionId} | Count: ${pulse.totalCount} | Rows: ${pulse.rowCount}`);

    return res.status(200).json({
      success: true,
      pulseId: pulse.pulseId,
      serverTimestamp: new Date().toISOString(),
      message: "Pulse received successfully"
    });
  });

  app.get("/api/pulses", (_req, res) => {
    return res.json({
      total: receivedPulses.length,
      pulses: receivedPulses.slice(-50).reverse()
    });
  });

  app.get("/api/pulses/session/:sessionId", (req, res) => {
    const sessionPulses = receivedPulses.filter(
      p => p.sessionId === req.params.sessionId
    );
    return res.json({
      sessionId: req.params.sessionId,
      total: sessionPulses.length,
      pulses: sessionPulses
    });
  });

  app.get("/api/stats", (_req, res) => {
    const sessions = new Set(receivedPulses.map(p => p.sessionId));
    const devices = new Set(receivedPulses.map(p => p.deviceId));

    let latestPulse = null;
    if (receivedPulses.length > 0) {
      latestPulse = receivedPulses[receivedPulses.length - 1];
    }

    return res.json({
      totalPulses: receivedPulses.length,
      uniqueSessions: sessions.size,
      uniqueDevices: devices.size,
      latestPulse,
      serverUptime: process.uptime()
    });
  });

  app.delete("/api/pulses", (_req, res) => {
    receivedPulses.length = 0;
    return res.json({ success: true, message: "All pulses cleared" });
  });

  app.get("/api/health", (_req, res) => {
    return res.json({
      status: "healthy",
      service: "NomadGo-SpatialVision Mock Server",
      version: "1.0.0",
      timestamp: new Date().toISOString()
    });
  });

  return httpServer;
}
