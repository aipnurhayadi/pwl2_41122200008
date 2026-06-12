import { useParams } from "react-router-dom";
import { CalendarClock } from "lucide-react";

import EmployeeAppLayout from "@/components/layouts/EmployeeAppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LecturerPreferences() {
  const { datasetId } = useParams();

  return (
    <EmployeeAppLayout
      title="Preferensi Mengajar"
      icon={CalendarClock}
      maxWidth="max-w-5xl"
      mainClassName="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint Belum Tersedia</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Modul preferensi dosen untuk dataset {datasetId} belum aktif di backend Laravel saat ini.
          </p>
          <p>
            Halaman ini akan diaktifkan kembali setelah endpoint preferensi dipindahkan.
          </p>
        </CardContent>
      </Card>
    </EmployeeAppLayout>
  );
}
