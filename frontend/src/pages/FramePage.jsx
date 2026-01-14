import { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import "./FramePage.css";

export default function FramePage() {
  const { frameId } = useParams();
  const { state } = useLocation();

  const meta = useMemo(() => {
    return {
      fileName: state?.fileName || "",
      sheetName: state?.sheetName || "",
      trackerType: state?.trackerType || "flat",
    };
  }, [state]);

  return (
    <div className="fp-shell">
      <header className="fp-topbar">
        <div className="fp-left">
          <Link to="/run-analysis" className="fp-link">
            ← Back to Plot
          </Link>
          <h1 className="fp-title">Frame {frameId}</h1>
          <div className="fp-subtitle">
            Placeholder page — we’ll add frame calculations + outputs here next.
          </div>
        </div>

        <div className="fp-meta">
          <div className="fp-chip">
            <div className="fp-chip-label">File</div>
            <div className="fp-chip-value">{meta.fileName || "—"}</div>
          </div>
          <div className="fp-chip">
            <div className="fp-chip-label">Sheet</div>
            <div className="fp-chip-value">{meta.sheetName || "—"}</div>
          </div>
          <div className="fp-chip">
            <div className="fp-chip-label">Tracker</div>
            <div className="fp-chip-value">{meta.trackerType.toUpperCase()}</div>
          </div>
        </div>
      </header>

      <main className="fp-content">
        <div className="fp-card">
          <h2 className="fp-card-title">BACKENDDDDDD</h2>
          
        </div>
      </main>
    </div>
  );
}
