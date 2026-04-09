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

function AppRoutes() {
  const { token } = useAuth();

  if (token) {
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
              <Route path="/:datasetId/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/:datasetId/lecturers" element={<ProtectedRoute><Lecturers /></ProtectedRoute>} />
              <Route path="/:datasetId/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
              <Route path="/:datasetId/time-slots" element={<ProtectedRoute><TimeSlots /></ProtectedRoute>} />
              <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/lecturers" element={<ProtectedRoute><Lecturers /></ProtectedRoute>} />
              <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
              <Route path="/time-slots" element={<ProtectedRoute><TimeSlots /></ProtectedRoute>} />
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
