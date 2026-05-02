import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DatasetProvider } from "@/context/DatasetContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import GuestHeader from "@/components/GuestHeader";
import ProtectedRoute from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import AdminHome from "@/pages/AdminHome";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Rooms from "@/pages/Rooms";
import Lecturers from "@/pages/Lecturers";
import Courses from "@/pages/Courses";
import TimeSlots from "@/pages/TimeSlots";
import Classes from "@/pages/Classes";
import Datasets from "@/pages/Datasets";
import Employees from "@/pages/Employees";
import MyDatasets from "@/pages/MyDatasets";
import DatasetDetail from "@/pages/DatasetDetail";

function AppRoutes() {
  const { token, user } = useAuth();

  if (token) {
    const isLecturer = user?.role === "LECTURER";

    if (isLecturer) {
      return (
        <Routes>
          <Route path="/" element={<Navigate to="/my-datasets" replace />} />
          <Route path="/login" element={<Navigate to="/my-datasets" replace />} />
          <Route path="/register" element={<Navigate to="/my-datasets" replace />} />
          <Route path="/my-datasets" element={<ProtectedRoute><MyDatasets /></ProtectedRoute>} />
          <Route path="/datasets/:datasetId" element={<ProtectedRoute><DatasetDetail /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/my-datasets" replace />} />
        </Routes>
      );
    }

    return (
      <DatasetProvider>
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 min-w-0 flex-col">
            <Navbar />
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/login" element={<Navigate to="/home" replace />} />
                <Route path="/register" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<ProtectedRoute><AdminHome /></ProtectedRoute>} />
                <Route path="/datasets" element={<ProtectedRoute><Datasets /></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
                <Route path="/my-datasets" element={<Navigate to="/home" replace />} />
                <Route path="/datasets/:datasetId" element={<ProtectedRoute><DatasetDetail /></ProtectedRoute>} />
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
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </main>
          </div>
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
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
