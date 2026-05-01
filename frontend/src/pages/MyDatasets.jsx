import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MyDatasets() {
  const { token, user, logout } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/datasets/my", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat dataset");
        return r.json();
      })
      .then((data) => {
        setDatasets(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Database className="h-5 w-5 text-primary" />
          <span>Dataset Saya</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.name}
          </span>
          <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4 mr-1" />
            Keluar
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Selamat datang, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">
            Berikut adalah daftar dataset yang Anda ditugaskan sebagai dosen.
          </p>
        </div>

        {loading && (
          <p className="text-muted-foreground">Memuat dataset...</p>
        )}

        {error && (
          <p className="text-destructive">{error}</p>
        )}

        {!loading && !error && datasets.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Belum ada dataset yang ditugaskan</p>
            <p className="text-sm mt-1">Hubungi admin untuk mendapatkan penugasan dataset.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((ds) => (
            <Card key={ds.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{ds.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {ds.code}
                  </Badge>
                </div>
                {ds.description && (
                  <CardDescription className="text-xs line-clamp-2">
                    {ds.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  ID Dataset: <span className="font-mono">{ds.id}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
