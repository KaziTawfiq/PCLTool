// Review.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import "./Review.css";

export default function Review() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [trackerType, setTrackerType] = useState("flat"); // "flat" | "xtr"

  const [pole, setPole] = useState([]);
  const [x, setX] = useState([]);
  const [y, setY] = useState([]);
  const [z, setZ] = useState([]);

  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Manual mapping letters (editable)
  const [poleCol, setPoleCol] = useState("C");
  const [xCol, setXCol] = useState("D");
  const [yCol, setYCol] = useState("E");
  const [zCol, setZCol] = useState("H");

  const [isApplying, setIsApplying] = useState(false);

  // ---------- helpers ----------
  const norm = (v) =>
    String(v ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const letterToColIndex = (letters) => {
    const s = String(letters || "").toUpperCase().trim();
    if (!s) return null;
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      if (code < 65 || code > 90) return null; // not A-Z
      n = n * 26 + (code - 64);
    }
    return n - 1; // A->0
  };

  const toNumberIfPossible = (v) => {
    if (typeof v === "number") return v;
    const s = String(v ?? "").trim();
    if (s === "") return "";
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  };

  const persistSafely = (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Reads BOM file and extracts pole/x/y/z from "Piling Information"
   * using provided 0-based indices, using header-name validation to find the start row.
   * (Keep this for DEFAULT / initial extraction because it works well.)
   */
  async function extractColumnsFromBom(bomFile, idx) {
    const buffer = await bomFile.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    // Find the "Piling Information" sheet (case-insensitive)
    const targetNameNorm = "piling information";
    const matchedSheetName =
      wb.SheetNames.find((name) => norm(name) === targetNameNorm) ||
      wb.SheetNames.find((name) => norm(name).includes(targetNameNorm));

    if (!matchedSheetName) {
      throw new Error('Could not find a sheet named "Piling Information".');
    }

    const ws = wb.Sheets[matchedSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: "",
    });

    if (!rows || rows.length === 0) {
      throw new Error('"Piling Information" sheet is empty.');
    }

    // Find header row where mapped columns contain expected labels
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || [];
      const poleH = norm(r[idx.pole]);
      const xH = norm(r[idx.x]);
      const yH = norm(r[idx.y]);
      const zH = norm(r[idx.z]);

      const poleOk = poleH === "pole";
      const xOk = xH === "x";
      const yOk = yH === "y";
      const zOk =
        zH === "z" ||
        zH === "z terrain enter" ||
        zH.includes("z terrain") ||
        zH.includes("z");

      if (poleOk && xOk && yOk && zOk) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error(
        `Could not find header row using mapping Pole=${poleCol}, X=${xCol}, Y=${yCol}, Z=${zCol}. Check your letters.`
      );
    }

    const startIndex = headerRowIndex + 1;

    const outPole = [];
    const outX = [];
    const outY = [];
    const outZ = [];

    let emptyStreak = 0;
    const EMPTY_STREAK_LIMIT = 25;

    for (let i = startIndex; i < rows.length; i++) {
      const r = rows[i] || [];

      const poleVal = r[idx.pole] ?? "";
      const xVal = r[idx.x] ?? "";
      const yVal = r[idx.y] ?? "";
      const zVal = r[idx.z] ?? "";

      const allEmpty =
        String(poleVal).trim() === "" &&
        String(xVal).trim() === "" &&
        String(yVal).trim() === "" &&
        String(zVal).trim() === "";

      if (allEmpty) {
        emptyStreak += 1;
        if (emptyStreak >= EMPTY_STREAK_LIMIT) break;
        continue;
      }

      emptyStreak = 0;

      outPole.push(toNumberIfPossible(poleVal));
      outX.push(xVal);
      outY.push(yVal);
      outZ.push(zVal);
    }

    if (!outPole.length) {
      throw new Error("Header found, but no data rows detected under that mapping.");
    }

    // ✅ Save start index for fast manual remap (tiny storage)
    persistSafely("pcl_data_start_index", String(startIndex));

    return { matchedSheetName, outPole, outX, outY, outZ };
  }

  /**
   * Manual remap extractor:
   * NO header-name checks. Just reads the chosen columns from the same sheet,
   * starting from the known startIndex (saved from initial extraction).
   */
  async function extractColumnsNoHeader(bomFile, idx, startIndex) {
    const buffer = await bomFile.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    const targetNameNorm = "piling information";
    const matchedSheetName =
      wb.SheetNames.find((name) => norm(name) === targetNameNorm) ||
      wb.SheetNames.find((name) => norm(name).includes(targetNameNorm));

    if (!matchedSheetName) {
      throw new Error('Could not find a sheet named "Piling Information".');
    }

    const ws = wb.Sheets[matchedSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: "",
    });

    if (!rows || rows.length === 0) {
      throw new Error('"Piling Information" sheet is empty.');
    }

    const start = Number.isFinite(startIndex) ? startIndex : 0;

    const outPole = [];
    const outX = [];
    const outY = [];
    const outZ = [];

    let emptyStreak = 0;
    const EMPTY_STREAK_LIMIT = 25;

    for (let i = start; i < rows.length; i++) {
      const r = rows[i] || [];

      const poleVal = r[idx.pole] ?? "";
      const xVal = r[idx.x] ?? "";
      const yVal = r[idx.y] ?? "";
      const zVal = r[idx.z] ?? "";

      const allEmpty =
        String(poleVal).trim() === "" &&
        String(xVal).trim() === "" &&
        String(yVal).trim() === "" &&
        String(zVal).trim() === "";

      if (allEmpty) {
        emptyStreak += 1;
        if (emptyStreak >= EMPTY_STREAK_LIMIT) break;
        continue;
      }

      emptyStreak = 0;

      outPole.push(toNumberIfPossible(poleVal));
      outX.push(xVal);
      outY.push(yVal);
      outZ.push(zVal);
    }

    if (!outPole.length) {
      throw new Error("No data found in the selected columns.");
    }

    return { matchedSheetName, outPole, outX, outY, outZ };
  }

  // ---------- initial load: fast from localStorage, else extract from bomFile (state) ----------
  useEffect(() => {
    setError("");
    setStatus("");

    // restore mapping letters if saved
    try {
      const savedLetters = JSON.parse(localStorage.getItem("pcl_mapping_letters") || "null");
      if (savedLetters?.pole && savedLetters?.x && savedLetters?.y && savedLetters?.z) {
        setPoleCol(String(savedLetters.pole).toUpperCase());
        setXCol(String(savedLetters.x).toUpperCase());
        setYCol(String(savedLetters.y).toUpperCase());
        setZCol(String(savedLetters.z).toUpperCase());
      }
    } catch {
      // ignore
    }

    // prefer localStorage columns (instant)
    try {
      const poleLS = JSON.parse(localStorage.getItem("pcl_columns_pole") || "[]");
      const xLS = JSON.parse(localStorage.getItem("pcl_columns_x") || "[]");
      const yLS = JSON.parse(localStorage.getItem("pcl_columns_y") || "[]");
      const zLS = JSON.parse(localStorage.getItem("pcl_columns_z") || "[]");
      const cfg = JSON.parse(localStorage.getItem("pcl_config") || "{}");

      setFileName(state?.fileName || cfg.fileName || "");
      setSheetName(cfg.sheetName || "Piling information");
      setTrackerType(cfg.trackerType || "flat");

      if (poleLS.length && xLS.length && yLS.length && zLS.length) {
        setPole(poleLS);
        setX(xLS);
        setY(yLS);
        setZ(zLS);
        return;
      }
    } catch {
      // ignore; we will try extracting from bomFile next
    }

    // if no localStorage columns yet, extract from bomFile in navigation state (first visit)
    const bomFile = state?.bomFile || null;
    if (bomFile) {
      (async () => {
        try {
          setStatus("Loading sheet…");
          const idx = {
            pole: letterToColIndex(poleCol) ?? 2,
            x: letterToColIndex(xCol) ?? 3,
            y: letterToColIndex(yCol) ?? 4,
            z: letterToColIndex(zCol) ?? 7,
          };

          const { matchedSheetName, outPole, outX, outY, outZ } =
            await extractColumnsFromBom(bomFile, idx);

          setFileName(state?.fileName || bomFile.name || "");
          setSheetName(matchedSheetName);
          setPole(outPole);
          setX(outX);
          setY(outY);
          setZ(outZ);
          setStatus("");

          // save columns for refresh-safe (may fail if too big)
          const ok1 = persistSafely("pcl_columns_pole", JSON.stringify(outPole));
          const ok2 = persistSafely("pcl_columns_x", JSON.stringify(outX));
          const ok3 = persistSafely("pcl_columns_y", JSON.stringify(outY));
          const ok4 = persistSafely("pcl_columns_z", JSON.stringify(outZ));
          persistSafely(
            "pcl_config",
            JSON.stringify({
              fileName: state?.fileName || bomFile.name,
              sheetName: matchedSheetName,
              trackerType: "flat",
            })
          );
          persistSafely(
            "pcl_mapping_letters",
            JSON.stringify({ pole: poleCol, x: xCol, y: yCol, z: zCol })
          );

          if (!(ok1 && ok2 && ok3 && ok4)) {
            setStatus(
              "Loaded. Note: browser storage is full, so refresh may require re-upload."
            );
          }
        } catch (e) {
          setStatus("");
          setError(e?.message || "Failed to read BOM file.");
        }
      })();
    } else {
      setError("No BOM file found. Go back to Uploads and continue again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const rowCount = useMemo(() => {
    return Math.min(pole.length, x.length, y.length, z.length);
  }, [pole, x, y, z]);

  const PREVIEW_N = 2000;
  const previewCount = Math.min(rowCount, PREVIEW_N);

  function proceedToGradingTool() {
    setError("");
    if (!rowCount) {
      setError("No rows found. Go back to Uploads and upload your BOM.");
      return;
    }
    navigate("/proceed-grading");
  }

  function goToParameters() {
    setError("");
    if (!rowCount) {
      setError("No rows found. Go back to Uploads and upload your BOM.");
      return;
    }
    navigate("/parameters", {
      state: { fileName, sheetName, trackerType, rowCount },
    });
  }

  // ✅ Apply mapping WITHOUT header-name checks: show whole columns user chooses
  async function applyMapping() {
    setError("");
    setStatus("");
    setIsApplying(true);

    try {
      const p = letterToColIndex(poleCol);
      const xc = letterToColIndex(xCol);
      const yc = letterToColIndex(yCol);
      const zc = letterToColIndex(zCol);

      if ([p, xc, yc, zc].some((v) => v === null)) {
        setError("Invalid column letter. Use A-Z (or AA, AB...).");
        return;
      }

      const bomFile = state?.bomFile || null;
      if (!bomFile) {
        setError("Remap needs the uploaded file. Go back to Uploads and continue again.");
        return;
      }

      // Use the same start row detected during initial extraction
      const startIndex = Number(localStorage.getItem("pcl_data_start_index")) || 0;

      setStatus("Applying mapping…");

      const { matchedSheetName, outPole, outX, outY, outZ } =
        await extractColumnsNoHeader(bomFile, { pole: p, x: xc, y: yc, z: zc }, startIndex);

      setSheetName(matchedSheetName);
      setPole(outPole);
      setX(outX);
      setY(outY);
      setZ(outZ);

      // save mapping letters only (safe)
      persistSafely(
        "pcl_mapping_letters",
        JSON.stringify({ pole: poleCol, x: xCol, y: yCol, z: zCol })
      );

      // best-effort cache columns
      const ok1 = persistSafely("pcl_columns_pole", JSON.stringify(outPole));
      const ok2 = persistSafely("pcl_columns_x", JSON.stringify(outX));
      const ok3 = persistSafely("pcl_columns_y", JSON.stringify(outY));
      const ok4 = persistSafely("pcl_columns_z", JSON.stringify(outZ));
      persistSafely(
        "pcl_config",
        JSON.stringify({
          fileName: fileName || bomFile.name,
          sheetName: matchedSheetName,
          trackerType,
        })
      );

      if (!(ok1 && ok2 && ok3 && ok4)) {
        setStatus("Applied. Note: browser storage is full, so refresh may require re-upload.");
      } else {
        setStatus("Applied.");
        setTimeout(() => setStatus(""), 1200);
      }
    } catch (e) {
      setStatus("");
      setError(e?.message || "Failed to apply mapping.");
    } finally {
      setIsApplying(false);
    }
  }

  const templateName =
    trackerType === "xtr" ? "XTR.xlsm" : "Flat Tracker Imperial.xlsm";

  return (
    <div className="review-shell">
      <div className="review-topbar">
        <div className="review-left">
          <h1 className="review-title">Copied Columns</h1>

          <div className="review-meta">
            <div className="review-filename">{fileName || "—"}</div>

            <div className="review-count">
              Sheet: <strong>{sheetName || "—"}</strong> · Rows copied:{" "}
              <strong>{rowCount}</strong>
              {rowCount > PREVIEW_N ? ` (showing first ${PREVIEW_N})` : ""}
            </div>

            <div className="review-count">
              Tracker: <strong>{trackerType.toUpperCase()}</strong> · Template:{" "}
              <strong>{templateName}</strong>
            </div>

            <div className="review-count">
              Current Mapping:{" "}
              <strong>
                Pole={poleCol}, X={xCol}, Y={yCol}, Z={zCol}
              </strong>
            </div>
          </div>
        </div>

        <div className="review-actions">
          <Link to="/uploads" className="review-link">
            ← Back
          </Link>

          <button className="review-btn" onClick={() => navigate("/uploads")}>
            Upload New
          </button>

          <button
            className="review-btn"
            onClick={goToParameters}
            disabled={!rowCount}
            title="Go to the next step to enter parameters"
          >
            Next: Parameters →
          </button>

          <button
            className="review-primary"
            onClick={proceedToGradingTool}
            disabled={!rowCount}
            title="Download the grading tool template + a CSV already mapped for Inputs sheet"
          >
            Proceed to use grading tool →
          </button>
        </div>
      </div>

      <div className="review-mappingbar">
        <div className="inst-title">Column assignments (change if needed)</div>

        <div className="review-maprow">
          <div className="review-mapfield">
            <label>Pole</label>
            <input
              className="review-mapinput"
              value={poleCol}
              onChange={(e) =>
                setPoleCol(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              placeholder="C"
            />
          </div>

          <div className="review-mapfield">
            <label>X</label>
            <input
              className="review-mapinput"
              value={xCol}
              onChange={(e) =>
                setXCol(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              placeholder="D"
            />
          </div>

          <div className="review-mapfield">
            <label>Y</label>
            <input
              className="review-mapinput"
              value={yCol}
              onChange={(e) =>
                setYCol(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              placeholder="E"
            />
          </div>

          <div className="review-mapfield">
            <label>Z</label>
            <input
              className="review-mapinput"
              value={zCol}
              onChange={(e) =>
                setZCol(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              placeholder="H"
            />
          </div>

          <button className="review-btn" onClick={applyMapping} disabled={isApplying}>
            {isApplying ? "Applying…" : "Apply"}
          </button>

          <div className="inst-list">
            Default: Pole=C, X=D, Y=E, Z=I. Type letters and click Apply.
            Manual remap ignores header names and shows the chosen columns.
          </div>
        </div>
      </div>

      {status && <div className="review-status">{status}</div>}
      {error && <div className="review-error">{error}</div>}

      <div className="review-window">
        {!rowCount ? (
          <div className="review-empty">No data to display.</div>
        ) : (
          <table className="review-table">
            <thead>
              <tr>
                <th>Pole ({poleCol})</th>
                <th>X ({xCol})</th>
                <th>Y ({yCol})</th>
                <th>Z ({zCol})</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: previewCount }).map((_, i) => (
                <tr key={i}>
                  <td>{String(pole[i] ?? "")}</td>
                  <td>{String(x[i] ?? "")}</td>
                  <td>{String(y[i] ?? "")}</td>
                  <td>{String(z[i] ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="review-footer">
        Next step: proceed to download the correct grading tool template and the auto-mapped Inputs CSV.
      </div>
    </div>
  );
}
