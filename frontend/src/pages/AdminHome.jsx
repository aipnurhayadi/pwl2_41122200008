import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminHome() {
  const { user } = useAuth();

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Welcome, {user?.name ?? "Admin"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Selamat datang di panel admin Timetable Tool. Gunakan menu di sidebar untuk
            mengelola dataset, employee, dan master data penjadwalan.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
