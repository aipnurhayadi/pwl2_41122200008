import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DatasetProvider } from "@/context/DatasetContext";
import Sidebar from "@/components/Sidebar";
import GuestHeader from "@/components/GuestHeader";
import ProtectedRoute from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Rooms from "@/pages/Rooms";
import Lecturers from "@/pages/Lecturers";
import Courses from "@/pages/Courses";
import TimeSlots from "@/pages/TimeSlots";
import Classes from "@/pages/Classes";
import MyDatasets from "@/pages/MyDatasets";

function AppRoutes() {
  const { token, user } = useAuth();

  if (token) {
    const isLecturer = user?.role === "LECTURER";
    const defaultRedirect = isLecturer ? "/my-datasets" : "/rooms";

    if (isLecturer) {
      return (
        <Routes>
          <Route path="/" element={<Navigate to="/my-datasets" replace />} />
          <Route path="/login" element={<Navigate to="/my-datasets" replace />} />
          <Route path="/register" element={<Navigate to="/my-datasets" replace />} />
          <Route path="/my-datasets" element={<ProtectedRoute><MyDatasets /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/my-datasets" replace />} />
        </Routes>
      );
    }

    return (
      <DatasetProvider>
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/rooms" replace />} />
              <Route path="/login" element={<Navigate to="/rooms" replace />} />
              <Route path="/register" element={<Navigate to="/rooms" replace />} />
              <Route path="/datasets" element={<Navigate to="/rooms" replace />} />
              <Route path="/my-datasets" element={<Navigate to="/rooms" replace />} />
              <Route path="/:datasetId/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/:datasetId/lecturers" element={<ProtectedRoute><Lecturers /></ProtectedRoute>} />
              <Route path="/:datasetId/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
              <Route path="/:datasetId/time-slots" element={<ProtectedRoute><TimeSlots /></ProtectedRoute>} />
              <Route path="/:datasetId/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
              <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/lecturers" element={<ProtectedRoute><Lecturers /></ProtectedRoute>} />
              <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
              <Route path="/time-slots" element={<ProtectedRoute><TimeSlots /></ProtectedRoute>} />
              <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </DatasetProvider>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GuestHeader />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/lecturer-login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
