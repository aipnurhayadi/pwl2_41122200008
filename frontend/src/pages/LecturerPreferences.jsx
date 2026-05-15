import { useParams } from "react-router-dom";
import { CalendarClock } from "lucide-react";

import EmployeeAppLayout from "@/components/layouts/EmployeeAppLayout";
import LecturerPreferencesTab from "@/components/dataset-detail/LecturerPreferencesTab";

export default function LecturerPreferences() {
  const { datasetId } = useParams();

  return (
    <EmployeeAppLayout
      title="Preferensi Mengajar"
      icon={CalendarClock}
      maxWidth="max-w-5xl"
      mainClassName="space-y-6"
    >
      <LecturerPreferencesTab datasetId={datasetId} />
    </EmployeeAppLayout>
  );
}
