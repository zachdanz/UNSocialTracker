import { Route, Routes } from "react-router-dom";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectPage from "./pages/ProjectPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<ProjectPage />} />
    </Routes>
  );
}
