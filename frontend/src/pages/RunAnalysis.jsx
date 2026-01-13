import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import "./RunAnalysis.css";

export default function RunAnalysis() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [fileName, setFileName] = useState(state?.fileName || "");
  const [sheetName, setSheetName] = useState(state?.sheetName || "");
  const [trackerType, setTrackerType] = useState(state?.trackerType || "flat");

  const [x, setX] = useState([]);
  const [y, setY] = useState([]);
  const [error, setError] = useState("");

  // Helpers
  const toNum = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  useEffect(() => {
    setError("");

    // Prefer state meta, but always load actual data from localStorage (fast + refresh safe)
    try {
      const cfg = JSON.parse(localStorage.getItem("pcl_config") || "{}");
      setFileName(state?.fileName || cfg.fileName || "");
      setSheetName(state?.sheetName || cfg.sheetName || "");
      setTrackerType(state?.trackerType || cfg.trackerType || "flat");

      const xLS = JSON.parse(localStorage.getItem("pcl_columns_x") || "[]");
      const yLS = JSON.parse(localStorage.getItem("pcl_columns_y") || "[]");

      if (!Array.isArray(xLS) || !Array.isArray(yLS) || !xLS.length || !yLS.length) {
        setError("No X/Y data found. Go back to Review and ensure columns are loaded.");
        return;
      }

      setX(xLS);
      setY(yLS);
    } catch {
      setError("Failed to load X/Y data. Go back to Review and try again.");
    }
  }, [state]);

  // Build numeric arrays (Plotly needs numbers). Keep only valid numeric pairs.
  const { xNum, yNum, dropped } = useMemo(() => {
    const n = Math.min(x.length, y.length);
    const xx = [];
    const yy = [];
    let drop = 0;

    for (let i = 0; i < n; i++) {
      const xv = toNum(x[i]);
      const yv = toNum(y[i]);
      if (xv === null || yv === null) {
        drop++;
        continue;
      }
      xx.push(xv);
      yy.push(yv);
    }

    return { xNum: xx, yNum: yy, dropped: drop };
  }, [x, y]);

  const pointCount = xNum.length;

  function goBack() {
    navigate("/parameters");
  }

  return (
    <div className="ra-shell">
      <header className="ra-topbar">
        <div className="ra-left">
          <Link to="/parameters" className="ra-link">
            ← Back
          </Link>

          <div className="ra-titlewrap">
            <h1 className="ra-title">Run Analysis</h1>
            <div className="ra-subtitle">
              Scatter plot of selected columns (X vs Y) — like Excel “Edit Series”.
            </div>
          </div>
        </div>

        <div className="ra-meta">
          <div className="ra-chip">
            <div className="ra-chip-label">File</div>
            <div className="ra-chip-value">{fileName || "—"}</div>
          </div>
          <div className="ra-chip">
            <div className="ra-chip-label">Sheet</div>
            <div className="ra-chip-value">{sheetName || "—"}</div>
          </div>
          <div className="ra-chip">
            <div className="ra-chip-label">Tracker</div>
            <div className="ra-chip-value">{trackerType.toUpperCase()}</div>
          </div>
          <div className="ra-chip">
            <div className="ra-chip-label">Points</div>
            <div className="ra-chip-value">{pointCount.toLocaleString()}</div>
          </div>
        </div>
      </header>

      {error && <div className="ra-error">{error}</div>}

      {!error && (
        <div className="ra-plotwrap">
          <Plot
            data={[
              {
                type: "scattergl", // fast for many points
                mode: "markers",
                x: xNum,
                y: yNum,
                marker: {
                  size: 4,
                  color: "#FFD400", // ✅ YELLOW points
                  opacity: 0.85,
                },
                hovertemplate:
                  "X: %{x}<br>Y: %{y}<extra></extra>",
                name: "Pile Coordinates",
              },
            ]}
            layout={{
              autosize: true,
              margin: { l: 60, r: 20, t: 30, b: 55 },
              paper_bgcolor: "#ffffff",
              plot_bgcolor: "#ffffff",
              xaxis: {
                title: "X",
                zeroline: false,
                showgrid: true,
                gridcolor: "#eef2f7",
              },
              yaxis: {
                title: "Y",
                zeroline: false,
                showgrid: true,
                gridcolor: "#eef2f7",
              },
              showlegend: false,
              hovermode: "closest",
            }}
            config={{
              responsive: true,
              displaylogo: false,
              scrollZoom: true, // nice like Excel zooming
              modeBarButtonsToRemove: ["lasso2d"], // keep it clean (optional)
            }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}

      {!error && (
        <footer className="ra-footer">
          Using X = selected X column, Y = selected Y column. Dropped non-numeric rows:{" "}
          <strong>{dropped.toLocaleString()}</strong>.
        </footer>
      )}

      <div className="ra-actions">
        <button className="ra-btn" onClick={goBack}>
          ← Back to Parameters
        </button>
      </div>
    </div>
  );
}
