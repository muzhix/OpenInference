import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { EditorPage } from "./pages/EditorPage";
import { LedgerPage } from "./pages/LedgerPage";

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Routes>
        <Route path="/workflows" element={<LedgerPage />} />
        <Route path="/build" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/workflows" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
