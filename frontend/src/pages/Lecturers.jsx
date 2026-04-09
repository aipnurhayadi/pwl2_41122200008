import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import { useDataset } from "@/context/DatasetContext";

export default function Lecturers() {
  const { datasetId } = useParams();
  const { selected } = useDataset();
  const dsName = selected?.name ?? (datasetId ? `Dataset #${datasetId}` : null);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-primary" />
          Dosen
        </h1>
        <p className="text-muted-foreground mt-1">
          {dsName ? <>Dataset: <span className="font-medium text-foreground">{dsName}</span></> : "Pilih dataset terlebih dahulu"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Halaman Dosen</CardTitle>
          <CardDescription>
            Halaman ini akan digunakan untuk mengelola data dosen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Fitur CRUD dosen dan penugasan mata kuliah sedang dalam pengembangan.</p>
        </CardContent>
      </Card>
    </main>
  );
}
