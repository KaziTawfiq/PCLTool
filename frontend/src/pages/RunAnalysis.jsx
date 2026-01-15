// RunAnalysis.jsx
// Purpose: Show scatter plot of frame locations and allow user to jump to a specific FramePage by frame number.
// Name: RunAnalysis.jsx
// Date created: 2026-01-15
// Method: Loads Frame/Pole/X/Y arrays from localStorage, renders Plotly scatter, supports click-to-navigate,
//         and adds a manual frame input + button to navigate to /frame/:frameId with required state.
// Data dictionary:
// - Inputs:
//   - localStorage: pcl_columns_frame, pcl_columns_pole, pcl_columns_x, pcl_columns_y
//   - route state: fileName, sheetName, trackerType
// - State:
//   - frameInput (string): user-entered frame id
//   - frameIdSet (Set<string>): valid frame ids present in dataset
// - Output:
//   - navigation to FramePage route with frameId + metadata

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

  // data (from localStorage)
  const [frame, setFrame] = useState([]); // Frame column (Table renamed to Frame)
  const [pole, setPole] = useState([]); // Pole column
  const [x, setX] = useState([]);
  const [y, setY] = useState([]);

  const [error, setError] = useState("");

  // NEW: manual frame jump
  const [frameInput, setFrameInput] = useState("");
  const [jumpError, setJumpError] = useState("");

  // Helpers
  const toNum = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const toIdPiece = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const n = Number(s);
    if (Number.isFinite(n)) return String(Math.trunc(n));
    return s;
  };

  useEffect(() => {
    setError("");
    setJumpError("");

    try {
      const cfg = JSON.parse(localStorage.getItem("pcl_config") || "{}");
      setFileName(state?.fileName || cfg.fileName || "");
      setSheetName(state?.sheetName || cfg.sheetName || "");
      setTrackerType(state?.trackerType || cfg.trackerType || "flat");

      const frameLS = JSON.parse(localStorage.getItem("pcl_columns_frame") || "[]");
      const poleLS = JSON.parse(localStorage.getItem("pcl_columns_pole") || "[]");
      const xLS = JSON.parse(localStorage.getItem("pcl_columns_x") || "[]");
      const yLS = JSON.parse(localStorage.getItem("pcl_columns_y") || "[]");

      if (
        !Array.isArray(frameLS) ||
        !frameLS.length ||
        !Array.isArray(poleLS) ||
        !poleLS.length ||
        !Array.isArray(xLS) ||
        !xLS.length ||
        !Array.isArray(yLS) ||
        !yLS.length
      ) {
        setError("Missing Frame/Pole/X/Y data. Go back to Review and ensure Frame + Pole + X + Y columns are loaded.");
        return;
      }

      setFrame(frameLS);
      setPole(poleLS);
      setX(xLS);
      setY(yLS);

      // Optional: prefill with first valid frame
      const first = toIdPiece(frameLS.find((v) => toIdPiece(v)));
      if (first) setFrameInput(first);
    } catch {
      setError("Failed to load data. Go back to Review and try again.");
    }
  }, [state]);

  // Build fast arrays for Plotly (one trace)
  const { xNum, yNum, customData, pointCount, dropped, frameIdSet } = useMemo(() => {
    const n = Math.min(frame.length, pole.length, x.length, y.length);

    const xx = [];
    const yy = [];
    const cd = [];
    let drop = 0;

    const ids = new Set();

    for (let i = 0; i < n; i++) {
      const xv = toNum(x[i]);
      const yv = toNum(y[i]);

      if (xv === null || yv === null) {
        drop++;
        continue;
      }

      const f = toIdPiece(frame[i]) || "—";
      const p = toIdPiece(pole[i]) || "—";

      if (f !== "—") ids.add(String(f));

      xx.push(xv);
      yy.push(yv);
      cd.push({ frame: f, pole: p, label: `${f}.${p}` });
    }

    return {
      xNum: xx,
      yNum: yy,
      customData: cd,
      pointCount: xx.length,
      dropped: drop,
      frameIdSet: ids,
    };
  }, [frame, pole, x, y]);

  function goBack() {
    navigate("/parameters");
  }

  function goToFrame(frameIdRaw) {
    const cleaned = toIdPiece(frameIdRaw);
    if (!cleaned || cleaned === "—") return;

    navigate(`/frame/${encodeURIComponent(cleaned)}`, {
      state: {
        frameId: cleaned,
        fileName,
        sheetName,
        trackerType,
        // Pass these so FramePage can build rows if needed
        frame,
        pole,
        x,
        y,
        // If you later add z in RunAnalysis, include it too.
      },
    });
  }

  // Click -> go to frame page
  function onPlotClick(e) {
    const pt = e?.points?.[0];
    if (!pt) return;

    const cd = pt.customdata;
    const frameId = cd?.frame;

    if (!frameId || frameId === "—") return;
    goToFrame(frameId);
  }

  function onJump() {
    setJumpError("");

    if (error) {
      setJumpError("Data is missing. Go back to Review and load columns first.");
      return;
    }

    const cleaned = toIdPiece(frameInput);
    if (!cleaned) {
      setJumpError("Enter a frame number.");
      return;
    }

    // Validate against known frames in the dataset (prevents going to a blank frame)
    if (frameIdSet && frameIdSet.size > 0 && !frameIdSet.has(String(cleaned))) {
      setJumpError(`Frame "${cleaned}" not found in uploaded data.`);
      return;
    }

    goToFrame(cleaned);
  }

  function onFrameInputKeyDown(e) {
    if (e.key === "Enter") onJump();
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
              Scatter plot (X vs Y). Hover shows <strong>Frame.Pole</strong>. Click a point or jump to a frame.
            </div>
          </div>

          {/* NEW: Jump to frame input */}
          <div className="ra-jump">
            <div className="ra-jump-label">Go to Frame</div>
            <div className="ra-jump-row">
              <input
                className="ra-jump-input"
                value={frameInput}
                onChange={(e) => setFrameInput(e.target.value)}
                onKeyDown={onFrameInputKeyDown}
                placeholder="e.g. 12"
                inputMode="numeric"
              />
              <button className="ra-jump-btn" onClick={onJump}>
                Open Frame
              </button>
            </div>
            {jumpError && <div className="ra-jump-error">{jumpError}</div>}
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
                type: "scattergl",
                mode: "markers",
                x: xNum,
                y: yNum,
                customdata: customData,
                marker: {
                  size: 4,
                  color: "#FFD400",
                  opacity: 0.85,
                },
                hovertemplate: "%{customdata.label}<extra></extra>",
                name: "Frame Locations",
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
              scrollZoom: true,
              modeBarButtonsToRemove: ["lasso2d"],
            }}
            style={{ width: "100%", height: "100%" }}
            onClick={onPlotClick}
          />
        </div>
      )}

      {!error && (
        <footer className="ra-footer">
          Hover shows Frame.Pole. Dropped non-numeric rows: <strong>{dropped.toLocaleString()}</strong>.
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
