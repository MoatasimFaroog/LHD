import { useState, useEffect, useCallback } from "react";
import "@fontsource/inter";

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

interface Stats {
  totalPulses: number;
  uniqueSessions: number;
  uniqueDevices: number;
  latestPulse: PulseData | null;
  serverUptime: number;
}

function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pulses, setPulses] = useState<PulseData[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "pulses" | "docs">("dashboard");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, pulsesRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/pulses")
      ]);
      const statsData = await statsRes.json();
      const pulsesData = await pulsesRes.json();
      setStats(statsData);
      setPulses(pulsesData.pulses || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const clearPulses = async () => {
    await fetch("/api/pulses", { method: "DELETE" });
    fetchData();
  };

  const sendTestPulse = async () => {
    const testPulse = {
      pulseId: `test_${Date.now().toString(36)}`,
      sessionId: `session_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: new Date().toISOString(),
      totalCount: Math.floor(Math.random() * 50) + 1,
      countsByLabel: [
        { label: "bottle", count: Math.floor(Math.random() * 15) + 1 },
        { label: "can", count: Math.floor(Math.random() * 10) + 1 },
        { label: "box", count: Math.floor(Math.random() * 8) + 1 }
      ],
      rowCount: Math.floor(Math.random() * 5) + 1,
      deviceId: "test-device-001",
      attemptCount: 0,
      status: "pending"
    };

    await fetch("/api/pulse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPulse)
    });
    fetchData();
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#0a0e17",
      color: "#e0e6ed",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }}>
      <header style={{
        background: "linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%)",
        borderBottom: "1px solid #21262d",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            background: "linear-gradient(135deg, #58a6ff 0%, #1f6feb 100%)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "16px",
            color: "#fff"
          }}>N</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "16px", color: "#f0f6fc" }}>NomadGo SpatialVision</div>
            <div style={{ fontSize: "11px", color: "#8b949e" }}>Mock Sync Server &middot; v1.0.0</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "#3fb950", boxShadow: "0 0 6px #3fb950"
          }} />
          <span style={{ fontSize: "12px", color: "#8b949e" }}>Server Online</span>
        </div>
      </header>

      <nav style={{
        display: "flex",
        gap: "0",
        borderBottom: "1px solid #21262d",
        background: "#0d1117",
        flexShrink: 0
      }}>
        {(["dashboard", "pulses", "docs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              background: activeTab === tab ? "#161b22" : "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #58a6ff" : "2px solid transparent",
              color: activeTab === tab ? "#f0f6fc" : "#8b949e",
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: "13px",
              cursor: "pointer",
              textTransform: "capitalize",
              fontFamily: "'Inter', sans-serif"
            }}
          >{tab}</button>
        ))}
      </nav>

      <main style={{
        flex: 1,
        overflow: "auto",
        padding: "20px 24px"
      }}>
        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
              <StatCard title="Total Pulses" value={stats?.totalPulses ?? 0} color="#58a6ff" />
              <StatCard title="Sessions" value={stats?.uniqueSessions ?? 0} color="#3fb950" />
              <StatCard title="Devices" value={stats?.uniqueDevices ?? 0} color="#d29922" />
              <StatCard title="Uptime" value={stats ? formatUptime(stats.serverUptime) : "—"} color="#bc8cff" />
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <ActionButton label="Send Test Pulse" onClick={sendTestPulse} color="#238636" />
              <ActionButton label="Clear All" onClick={clearPulses} color="#da3633" />
              <ActionButton
                label={autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
                onClick={() => setAutoRefresh(!autoRefresh)}
                color={autoRefresh ? "#1f6feb" : "#484f58"}
              />
              <ActionButton label="Refresh Now" onClick={fetchData} color="#30363d" />
            </div>

            {stats?.latestPulse && (
              <div style={{
                background: "#161b22",
                border: "1px solid #21262d",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px"
              }}>
                <div style={{ fontSize: "13px", color: "#8b949e", marginBottom: "8px", fontWeight: 600 }}>Latest Pulse</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                  <InfoItem label="Pulse ID" value={stats.latestPulse.pulseId || "—"} />
                  <InfoItem label="Session" value={stats.latestPulse.sessionId} />
                  <InfoItem label="Total Count" value={String(stats.latestPulse.totalCount)} />
                  <InfoItem label="Rows" value={String(stats.latestPulse.rowCount)} />
                  <InfoItem label="Device" value={stats.latestPulse.deviceId} />
                  <InfoItem label="Time" value={new Date(stats.latestPulse.timestamp).toLocaleTimeString()} />
                </div>
                {stats.latestPulse.countsByLabel && stats.latestPulse.countsByLabel.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "6px" }}>Counts by Label:</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {stats.latestPulse.countsByLabel.map((lc, i) => (
                        <span key={i} style={{
                          background: "#1f6feb20",
                          border: "1px solid #1f6feb40",
                          borderRadius: "12px",
                          padding: "3px 10px",
                          fontSize: "12px",
                          color: "#58a6ff"
                        }}>{lc.label}: {lc.count}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: "8px",
              padding: "16px"
            }}>
              <div style={{ fontSize: "13px", color: "#8b949e", marginBottom: "12px", fontWeight: 600 }}>
                API Endpoints
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <EndpointRow method="POST" path="/api/pulse" desc="Receive sync pulse from device" />
                <EndpointRow method="GET" path="/api/pulses" desc="List all received pulses (last 50)" />
                <EndpointRow method="GET" path="/api/pulses/session/:id" desc="Get pulses for a session" />
                <EndpointRow method="GET" path="/api/stats" desc="Server statistics" />
                <EndpointRow method="DELETE" path="/api/pulses" desc="Clear all stored pulses" />
                <EndpointRow method="GET" path="/api/health" desc="Health check" />
              </div>
            </div>
          </div>
        )}

        {activeTab === "pulses" && (
          <div>
            <div style={{ fontSize: "13px", color: "#8b949e", marginBottom: "12px" }}>
              Showing {pulses.length} most recent pulses
            </div>
            {pulses.length === 0 ? (
              <div style={{
                background: "#161b22",
                border: "1px solid #21262d",
                borderRadius: "8px",
                padding: "40px",
                textAlign: "center",
                color: "#484f58"
              }}>
                No pulses received yet. Send a test pulse or connect your Unity app.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pulses.map((p, i) => (
                  <div key={i} style={{
                    background: "#161b22",
                    border: "1px solid #21262d",
                    borderRadius: "6px",
                    padding: "12px 16px",
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 80px 60px 140px",
                    alignItems: "center",
                    gap: "12px",
                    fontSize: "13px"
                  }}>
                    <span style={{ color: "#58a6ff", fontFamily: "monospace", fontSize: "12px" }}>{p.pulseId || "—"}</span>
                    <span style={{ color: "#8b949e" }}>{p.sessionId}</span>
                    <span style={{ color: "#3fb950", fontWeight: 600 }}>Count: {p.totalCount}</span>
                    <span style={{ color: "#d29922" }}>R{p.rowCount}</span>
                    <span style={{ color: "#484f58", fontSize: "11px" }}>{new Date(p.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "docs" && (
          <div style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: "8px",
            padding: "24px",
            maxWidth: "800px",
            lineHeight: "1.6"
          }}>
            <h2 style={{ color: "#f0f6fc", marginTop: 0, fontSize: "20px" }}>NomadGo SpatialVision — Mock Server</h2>
            <p style={{ color: "#8b949e", fontSize: "14px" }}>
              This is the mock sync server for the NomadGo SpatialVision Unity AR application.
              It receives sync pulses from the mobile device during inventory scanning sessions.
            </p>

            <h3 style={{ color: "#f0f6fc", fontSize: "16px", marginTop: "24px" }}>Configuration</h3>
            <p style={{ color: "#8b949e", fontSize: "14px" }}>
              In your Unity project, set the sync base URL in <code style={{ background: "#0d1117", padding: "2px 6px", borderRadius: "4px", color: "#58a6ff" }}>Assets/Resources/CONFIG.json</code>:
            </p>
            <pre style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: "6px",
              padding: "12px",
              fontSize: "13px",
              color: "#e6edf3",
              overflow: "auto"
            }}>{`{
  "sync": {
    "base_url": "https://YOUR_REPLIT_URL/api/pulse",
    "pulse_interval_seconds": 5,
    "retry_max_attempts": 5,
    "retry_base_delay_seconds": 2,
    "retry_max_delay_seconds": 60,
    "queue_persistent": true
  }
}`}</pre>

            <h3 style={{ color: "#f0f6fc", fontSize: "16px", marginTop: "24px" }}>Pulse Payload Format</h3>
            <pre style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: "6px",
              padding: "12px",
              fontSize: "13px",
              color: "#e6edf3",
              overflow: "auto"
            }}>{`{
  "pulseId": "a1b2c3d4",
  "sessionId": "session_abc123",
  "timestamp": "2026-02-13T10:30:00.000Z",
  "totalCount": 42,
  "countsByLabel": [
    { "label": "bottle", "count": 15 },
    { "label": "can", "count": 12 },
    { "label": "box", "count": 15 }
  ],
  "rowCount": 3,
  "deviceId": "device-unique-id",
  "attemptCount": 0,
  "status": "pending"
}`}</pre>

            <h3 style={{ color: "#f0f6fc", fontSize: "16px", marginTop: "24px" }}>Project Structure</h3>
            <pre style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: "6px",
              padding: "12px",
              fontSize: "12px",
              color: "#e6edf3",
              overflow: "auto"
            }}>{`NomadGo-SpatialVision/
├── Assets/
│   ├── Scenes/Main.unity
│   ├── Scripts/
│   │   ├── AppShell/        (AppManager, AppConfig, ScanUIController)
│   │   ├── Spatial/         (SpatialManager, PlaneDetector, DepthEstimator)
│   │   ├── Vision/          (ONNXInferenceEngine, DetectionResult, FrameProcessor)
│   │   ├── Counting/        (CountManager, IOUTracker, RowClusterEngine)
│   │   ├── AROverlay/       (OverlayRenderer, BoundingBoxDrawer, CountLabel)
│   │   ├── Storage/         (SessionStorage, JSONStorageProvider, SessionData)
│   │   ├── Sync/            (SyncPulseManager, PulseQueue, NetworkMonitor)
│   │   └── Diagnostics/     (DiagnosticsManager, FPSOverlay, InferenceTimer, MemoryMonitor)
│   ├── Models/              (yolov8n.onnx, labels.txt)
│   └── Resources/CONFIG.json
├── Docs/
│   ├── RUNBOOK.md
│   └── QA_CHECKLIST.md
└── MockServer/              (This Replit server)`}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: "#161b22",
      border: "1px solid #21262d",
      borderRadius: "8px",
      padding: "16px 20px",
      minWidth: "140px",
      flex: "1"
    }}>
      <div style={{ fontSize: "11px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{title}</div>
      <div style={{ fontSize: "24px", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function ActionButton({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        background: color,
        border: "1px solid transparent",
        borderRadius: "6px",
        color: "#f0f6fc",
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "'Inter', sans-serif"
      }}
    >{label}</button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "#484f58" }}>{label}</div>
      <div style={{ fontSize: "13px", color: "#e6edf3", fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColors: Record<string, string> = {
    GET: "#3fb950",
    POST: "#58a6ff",
    DELETE: "#da3633",
    PUT: "#d29922"
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "6px 0",
      borderBottom: "1px solid #21262d10"
    }}>
      <span style={{
        background: (methodColors[method] || "#484f58") + "20",
        color: methodColors[method] || "#484f58",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 700,
        fontFamily: "monospace",
        minWidth: "52px",
        textAlign: "center"
      }}>{method}</span>
      <span style={{ color: "#e6edf3", fontFamily: "monospace", fontSize: "13px", minWidth: "220px" }}>{path}</span>
      <span style={{ color: "#8b949e", fontSize: "12px" }}>{desc}</span>
    </div>
  );
}

export default App;
