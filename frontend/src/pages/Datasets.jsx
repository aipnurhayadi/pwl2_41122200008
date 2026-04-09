import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";

export default function Datasets() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          Datasets
        </h1>
        <p className="text-muted-foreground mt-1">Manajemen dataset penjadwalan kelas</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Halaman Datasets</CardTitle>
          <CardDescription>
            Halaman ini akan digunakan untuk mengelola dataset penjadwalan. Setiap dataset
            merupakan satu skenario penjadwalan yang berisi kumpulan ruangan, dosen, mata
            kuliah, dan slot waktu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Fitur CRUD dataset sedang dalam pengembangan.</p>
        </CardContent>
      </Card>
    </main>
  );
}
