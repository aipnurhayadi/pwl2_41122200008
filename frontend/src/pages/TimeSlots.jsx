import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useDataset } from "@/context/AuthContext";

export default function TimeSlots() {
  const { datasetId } = useParams();
  const { selected } = useDataset();
  const dsName = selected?.name ?? (datasetId ? `Dataset #${datasetId}` : null);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Clock className="h-8 w-8 text-primary" />
          Slot Waktu
        </h1>
        <p className="text-muted-foreground mt-1">
          {dsName ? <>Dataset: <span className="font-medium text-foreground">{dsName}</span></> : "Pilih dataset terlebih dahulu"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Halaman Slot Waktu</CardTitle>
          <CardDescription>
            Halaman ini akan digunakan untuk mengelola data slot waktu. Setiap slot waktu
            mendefinisikan hari, jam mulai, jam selesai, dan apakah termasuk sesi pagi —
            yang digunakan sebagai preferensi dalam penjadwalan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Fitur CRUD slot waktu sedang dalam pengembangan.</p>
        </CardContent>
      </Card>
    </main>
  );
}
