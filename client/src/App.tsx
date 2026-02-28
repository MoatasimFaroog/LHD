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
    <div className="w-screen h-screen bg-[#0a0e17] text-[#e0e6ed] font-['Inter',sans-serif] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-b border-[#21262d] px-3 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-[#58a6ff] to-[#1f6feb] rounded-lg flex items-center justify-center font-bold text-sm sm:text-base text-white shrink-0">
            N
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm sm:text-base text-[#f0f6fc] truncate">NomadGo SpatialVision</div>
            <div className="text-[10px] sm:text-[11px] text-[#8b949e]">Mock Sync Server &middot; v1.0.0</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#3fb950] shadow-[0_0_6px_#3fb950]" />
          <span className="text-[11px] sm:text-xs text-[#8b949e] hidden xs:inline">Server Online</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex border-b border-[#21262d] bg-[#0d1117] shrink-0">
        {(["dashboard", "pulses", "docs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-2.5 border-b-2 text-xs sm:text-[13px] capitalize font-['Inter',sans-serif] transition-colors min-h-[44px] sm:min-h-0 ${
              activeTab === tab
                ? "bg-[#161b22] border-[#58a6ff] text-[#f0f6fc] font-semibold"
                : "bg-transparent border-transparent text-[#8b949e] font-normal"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-3 sm:p-5 overscroll-contain">
        {activeTab === "dashboard" && (
          <div>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
              <StatCard title="Total Pulses" value={stats?.totalPulses ?? 0} color="text-[#58a6ff]" />
              <StatCard title="Sessions" value={stats?.uniqueSessions ?? 0} color="text-[#3fb950]" />
              <StatCard title="Devices" value={stats?.uniqueDevices ?? 0} color="text-[#d29922]" />
              <StatCard title="Uptime" value={stats ? formatUptime(stats.serverUptime) : "—"} color="text-[#bc8cff]" />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-4 sm:mb-5">
              <ActionButton label="Send Test Pulse" onClick={sendTestPulse} bgColor="bg-[#238636]" />
              <ActionButton label="Clear All" onClick={clearPulses} bgColor="bg-[#da3633]" />
              <ActionButton
                label={autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
                onClick={() => setAutoRefresh(!autoRefresh)}
                bgColor={autoRefresh ? "bg-[#1f6feb]" : "bg-[#484f58]"}
              />
              <ActionButton label="Refresh Now" onClick={fetchData} bgColor="bg-[#30363d]" />
            </div>

            {/* Latest Pulse */}
            {stats?.latestPulse && (
              <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 sm:p-4 mb-4 sm:mb-5">
                <div className="text-[13px] text-[#8b949e] mb-2 font-semibold">Latest Pulse</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                  <InfoItem label="Pulse ID" value={stats.latestPulse.pulseId || "—"} />
                  <InfoItem label="Session" value={stats.latestPulse.sessionId} />
                  <InfoItem label="Total Count" value={String(stats.latestPulse.totalCount)} />
                  <InfoItem label="Rows" value={String(stats.latestPulse.rowCount)} />
                  <InfoItem label="Device" value={stats.latestPulse.deviceId} />
                  <InfoItem label="Time" value={new Date(stats.latestPulse.timestamp).toLocaleTimeString()} />
                </div>
                {stats.latestPulse.countsByLabel && stats.latestPulse.countsByLabel.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-[#8b949e] mb-1.5">Counts by Label:</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {stats.latestPulse.countsByLabel.map((lc, i) => (
                        <span
                          key={i}
                          className="bg-[#1f6feb20] border border-[#1f6feb40] rounded-full px-2.5 py-0.5 text-xs text-[#58a6ff]"
                        >
                          {lc.label}: {lc.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* API Endpoints */}
            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 sm:p-4">
              <div className="text-[13px] text-[#8b949e] mb-3 font-semibold">API Endpoints</div>
              <div className="flex flex-col gap-1.5">
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
            <div className="text-[13px] text-[#8b949e] mb-3">
              Showing {pulses.length} most recent pulses
            </div>
            {pulses.length === 0 ? (
              <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-8 sm:p-10 text-center text-[#484f58]">
                No pulses received yet. Send a test pulse or connect your Unity app.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pulses.map((p, i) => (
                  <PulseCard key={i} pulse={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "docs" && (
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-4 sm:p-6 max-w-3xl leading-relaxed">
            <h2 className="text-[#f0f6fc] mt-0 text-lg sm:text-xl font-bold">NomadGo SpatialVision — Mock Server</h2>
            <p className="text-[#8b949e] text-sm">
              This is the mock sync server for the NomadGo SpatialVision Unity AR application.
              It receives sync pulses from the mobile device during inventory scanning sessions.
            </p>

            <h3 className="text-[#f0f6fc] text-sm sm:text-base mt-6 font-semibold">Configuration</h3>
            <p className="text-[#8b949e] text-sm">
              In your Unity project, set the sync base URL in{" "}
              <code className="bg-[#0d1117] px-1.5 py-0.5 rounded text-[#58a6ff] text-xs">Assets/Resources/CONFIG.json</code>:
            </p>
            <pre className="bg-[#0d1117] border border-[#21262d] rounded-md p-3 text-xs sm:text-[13px] text-[#e6edf3] overflow-x-auto whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal">{`{
  "sync": {
    "base_url": "https://YOUR_REPLIT_URL/api/pulse",
    "pulse_interval_seconds": 5,
    "retry_max_attempts": 5,
    "retry_base_delay_seconds": 2,
    "retry_max_delay_seconds": 60,
    "queue_persistent": true
  }
}`}</pre>

            <h3 className="text-[#f0f6fc] text-sm sm:text-base mt-6 font-semibold">Pulse Payload Format</h3>
            <pre className="bg-[#0d1117] border border-[#21262d] rounded-md p-3 text-xs sm:text-[13px] text-[#e6edf3] overflow-x-auto whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal">{`{
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

            <h3 className="text-[#f0f6fc] text-sm sm:text-base mt-6 font-semibold">Project Structure</h3>
            <pre className="bg-[#0d1117] border border-[#21262d] rounded-md p-3 text-[11px] sm:text-xs text-[#e6edf3] overflow-x-auto whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal">{`NomadGo-SpatialVision/
├── Assets/
│   ├── Scenes/Main.unity
│   ├── Scripts/
│   │   ├── AppShell/
│   │   ├── Spatial/
│   │   ├── Vision/
│   │   ├── Counting/
│   │   ├── AROverlay/
│   │   ├── Storage/
│   │   ├── Sync/
│   │   └── Diagnostics/
│   ├── Models/
│   └── Resources/CONFIG.json
├── Docs/
│   ├── RUNBOOK.md
│   └── QA_CHECKLIST.md
└── MockServer/`}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 sm:p-4 min-w-0">
      <div className="text-[10px] sm:text-[11px] text-[#8b949e] uppercase tracking-wide mb-1">{title}</div>
      <div className={`text-lg sm:text-2xl font-bold ${color} truncate`}>{value}</div>
    </div>
  );
}

function ActionButton({ label, onClick, bgColor }: { label: string; onClick: () => void; bgColor: string }) {
  return (
    <button
      onClick={onClick}
      className={`${bgColor} px-3 sm:px-3.5 py-2 sm:py-1.5 border border-transparent rounded-md text-[#f0f6fc] text-[11px] sm:text-xs font-medium font-['Inter',sans-serif] active:opacity-80 transition-opacity min-h-[44px] sm:min-h-0 touch-manipulation`}
    >
      {label}
    </button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] sm:text-[11px] text-[#484f58]">{label}</div>
      <div className="text-xs sm:text-[13px] text-[#e6edf3] font-mono truncate">{value}</div>
    </div>
  );
}

function PulseCard({ pulse }: { pulse: PulseData }) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-3 sm:p-3">
      {/* Mobile: stacked card layout / Desktop: grid row */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center justify-between">
          <span className="text-[#58a6ff] font-mono text-xs truncate max-w-[50%]">{pulse.pulseId || "—"}</span>
          <span className="text-[#3fb950] font-semibold text-xs">Count: {pulse.totalCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#8b949e] text-xs truncate max-w-[60%]">{pulse.sessionId}</span>
          <span className="text-[#d29922] text-xs">R{pulse.rowCount}</span>
        </div>
        <div className="text-[#484f58] text-[10px]">{new Date(pulse.timestamp).toLocaleString()}</div>
        {pulse.countsByLabel && pulse.countsByLabel.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {pulse.countsByLabel.map((lc, i) => (
              <span
                key={i}
                className="bg-[#1f6feb15] border border-[#1f6feb30] rounded-full px-2 py-0.5 text-[10px] text-[#58a6ff]"
              >
                {lc.label}: {lc.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: grid row */}
      <div className="hidden sm:grid sm:grid-cols-[minmax(100px,1fr)_minmax(120px,2fr)_80px_50px_140px] items-center gap-3 text-[13px]">
        <span className="text-[#58a6ff] font-mono text-xs truncate">{pulse.pulseId || "—"}</span>
        <span className="text-[#8b949e] truncate">{pulse.sessionId}</span>
        <span className="text-[#3fb950] font-semibold">Count: {pulse.totalCount}</span>
        <span className="text-[#d29922]">R{pulse.rowCount}</span>
        <span className="text-[#484f58] text-[11px]">{new Date(pulse.timestamp).toLocaleString()}</span>
      </div>
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColorMap: Record<string, string> = {
    GET: "bg-[#3fb95020] text-[#3fb950]",
    POST: "bg-[#58a6ff20] text-[#58a6ff]",
    DELETE: "bg-[#da363320] text-[#da3633]",
    PUT: "bg-[#d2992220] text-[#d29922]"
  };

  const colorClasses = methodColorMap[method] || "bg-[#484f5820] text-[#484f58]";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-1.5 border-b border-[#21262d]/10 last:border-b-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={`${colorClasses} px-2 py-0.5 rounded text-[11px] font-bold font-mono min-w-[52px] text-center shrink-0`}>
          {method}
        </span>
        <span className="text-[#e6edf3] font-mono text-xs sm:text-[13px] sm:min-w-[220px] truncate">{path}</span>
      </div>
      <span className="text-[#8b949e] text-[11px] sm:text-xs pl-[68px] sm:pl-0">{desc}</span>
    </div>
  );
}

export default App;
