import { Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Employees() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" /> Employee
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Halaman employee sedang disesuaikan dengan backend Laravel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint Belum Tersedia</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Endpoint employee (`/api/employees`) belum dipindahkan ke backend Laravel saat ini,
            sehingga operasi daftar/tambah/ubah/hapus employee belum dapat dijalankan.
          </p>
          <p>
            Setelah endpoint employee dipindahkan, halaman ini akan dikembalikan ke mode penuh.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
