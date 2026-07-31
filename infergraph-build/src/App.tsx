import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { EditorPage } from "./pages/EditorPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/workflows/local" element={<EditorPage />} />
        <Route path="/workflows/local/:workflowId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/workflows/local" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
