import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Shell from "./components/Shell";
import { Loading, ToastProvider } from "./components/ui";

const Lobby = lazy(() => import("./pages/Lobby"));
const Dream = lazy(() => import("./pages/Dream"));
const Agents = lazy(() => import("./pages/Agents"));
const AgentRoom = lazy(() => import("./pages/AgentRoom"));
const Missions = lazy(() => import("./pages/Missions"));
const Skills = lazy(() => import("./pages/Skills"));
const Memory = lazy(() => import("./pages/Memory"));
const Graphs = lazy(() => import("./pages/Graphs"));
const Documents = lazy(() => import("./pages/Documents"));
const Automations = lazy(() => import("./pages/Automations"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Activity = lazy(() => import("./pages/Activity"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Settings = lazy(() => import("./pages/Settings"));
const Setup = lazy(() => import("./pages/Setup"));
const Business = lazy(() => import("./pages/Business"));

export default function App() {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="main"><Loading /></div>}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Lobby />} />
            <Route path="dream" element={<Dream />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:id" element={<AgentRoom />} />
            <Route path="missions" element={<Missions />} />
            <Route path="missions/:id" element={<Missions />} />
            <Route path="skills" element={<Skills />} />
            <Route path="memory" element={<Memory />} />
            <Route path="graphs" element={<Graphs />} />
            <Route path="graphs/:projectId" element={<Graphs />} />
            <Route path="documents" element={<Documents />} />
            <Route path="automations" element={<Automations />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="activity" element={<Activity />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="settings" element={<Settings />} />
            <Route path="setup" element={<Setup />} />
            <Route path="business" element={<Business />} />
            <Route path="*" element={<Lobby />} />
          </Route>
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}
