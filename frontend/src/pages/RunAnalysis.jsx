// RunAnalysis.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import "./RunAnalysis.css";

/**
 * RunAnalysis
 * Purpose: Display an interactive Plotly scatter plot of X vs Y from the mapped columns.
 * Notes:
 * - Reads mapped arrays from localStorage: pcl_columns_x, pcl_columns_y
 * - Uses scattergl for performance on large datasets
 * - Downsamples if extremely large to keep the UI responsive
 */
export default function RunAnalysis() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [fileName, setFileName] = useState(state?.fileName || "");
  const [sheetName, setSheetName] = useState(state?.sheetName || "");
  const [trackerType, setTrackerType] = useState(state?.trackerType || "flat");

  const [x, setX] = useState([]);
  const [y, setY] = useState([]);

  const [status, setStatus] = useState("Loading plot data…");
  const [error, setError] = useState("");

  // Load X/Y from localStorage (fast + consistent with your Review page)
  useEffect(() => {
    setError("");
    setStatus("Loading plot data…");

    try {
      const cfg = JSON.parse(localStorage.getItem("pcl_config") || "{}");
      const xLS = JSON.parse(localStorage.getItem("pcl_columns_x") || "[]");
      const yLS = JSON.parse(localStorage.getItem("pcl_columns_y") || "[]");

      setFileName(state?.fileName || cfg.fileName || "");
      setSheetName(state?.sheetName || cfg.sheetName || "");
      setTrackerType(state?.trackerType || cfg.trackerType || "flat");

      if (!Array.isArray(xLS) || !Array.isArray(yLS) || !xLS.length || !yLS.length) {
        setError("No X/Y columns found. Go back to Review and ensure columns are mapped.");
        setStatus("");
        return;
      }

      setX(xLS);
      setY(yLS);
      setStatus("");
    } catch {
      setError("Failed to load plot data. Go back to Review and try again.");
      setStatus("");
    }
  }, [state]);

  // Build numeric scatter arrays (ignore non-numeric rows)
  const { xs, ys, dropped } = useMemo(() => {
    const n = Math.min(x.length, y.length);
    const outX = [];
    const outY = [];
    let drop = 0;

    for (let i = 0; i < n; i++) {
      const xi = Number(String(x[i] ?? "").trim());
      const yi = Number(String(y[i] ?? "").trim());
      if (Number.isFinite(xi) && Number.isFinite(yi)) {
        outX.push(xi);
        outY.push(yi);
      } else {
        drop++;
      }
    }
    return { xs: outX, ys: outY, dropped: drop };
  }, [x, y]);

  // Downsample if huge (keeps browser smooth)
  const MAX_POINTS = 200_000;
  const { plotX, plotY, sampled } = useMemo(() => {
    const n = xs.length;
    if (n <= MAX_POINTS) return { plotX: xs, plotY: ys, sampled: false };

    const step = Math.ceil(n / MAX_POINTS);
    const outX = [];
    const outY = [];
    for (let i = 0; i < n; i += step) {
      outX.push(xs[i]);
      outY.push(ys[i]);
    }
    return { plotX: outX, plotY: outY, sampled: true };
  }, [xs, ys]);

  const pointCount = plotX.length;

  function goBack() {
    navigate("/parameters");
  }

  return (
    <div className="ra-shell">
      <header className="ra-topbar">
        <div className="ra-left">
          <button className="ra-back" onClick={goBack}>
            ← Back
          </button>

          <div className="ra-titlewrap">
            <h1 className="ra-title">Run Analysis</h1>
            <div className="ra-subtitle">
              Interactive scatter plot of <strong>X</strong> vs <strong>Y</strong> from your mapped columns.
            </div>
          </div>
        </div>

        <div className="ra-actions">
          <Link to="/review" className="ra-link">
            ← Review
          </Link>
          <Link to="/uploads" className="ra-link">
            Upload New
          </Link>
          <div className="ra-badge">Step 4</div>
        </div>
      </header>

      <div className="ra-meta">
        <div className="ra-chip">
          <span className="ra-chip-label">File</span>
          <span className="ra-chip-val">{fileName || "—"}</span>
        </div>
        <div className="ra-chip">
          <span className="ra-chip-label">Sheet</span>
          <span className="ra-chip-val">{sheetName || "—"}</span>
        </div>
        <div className="ra-chip">
          <span className="ra-chip-label">Tracker</span>
          <span className="ra-chip-val">{String(trackerType).toUpperCase()}</span>
        </div>
        <div className="ra-chip">
          <span className="ra-chip-label">Points</span>
          <span className="ra-chip-val">{pointCount.toLocaleString()}</span>
        </div>
        {dropped > 0 && (
          <div className="ra-chip ra-chip-warn" title="Rows that could not be converted to numbers were skipped.">
            <span className="ra-chip-label">Skipped</span>
            <span className="ra-chip-val">{dropped.toLocaleString()}</span>
          </div>
        )}
        {sampled && (
          <div className="ra-chip ra-chip-warn" title="Plot was downsampled for performance.">
            <span className="ra-chip-label">Note</span>
            <span className="ra-chip-val">Downsampled</span>
          </div>
        )}
      </div>

      {status && <div className="ra-status">{status}</div>}
      {error && <div className="ra-error">{error}</div>}

      <main className="ra-plotwrap">
        {!error && (
          <div className="ra-card">
            <div className="ra-cardhead">
              <div className="ra-cardtitle">X vs Y Scatter</div>
              <div className="ra-cardhint">
                Pan/zoom, box select, lasso select, and hover are enabled.
              </div>
            </div>

            <div className="ra-plot">
              <Plot
                data={[
                  {
                    type: "scattergl",
                    mode: "markers",
                    x: plotX,
                    y: plotY,
                    marker: {
                      size: 5,
                      opacity: 0.75,
                    },
                    hovertemplate: "X=%{x}<br>Y=%{y}<extra></extra>",
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 60, r: 20, t: 30, b: 55 },
                  xaxis: { title: "X", zeroline: false },
                  yaxis: { title: "Y", zeroline: false },
                  paper_bgcolor: "rgba(0,0,0,0)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                  dragmode: "pan",
                  showlegend: false,
                }}
                config={{
                  responsive: true,
                  displaylogo: false,
                  scrollZoom: true,
                  modeBarButtonsToRemove: ["toImage"], // optional
                }}
                style={{ width: "100%", height: "100%" }}
                useResizeHandler
              />
            </div>
          </div>
        )}
      </main>

      <footer className="ra-footer">
        Tip: If the plot is dense, use box select or zoom to inspect smaller regions.
      </footer>
    </div>
  );
}
