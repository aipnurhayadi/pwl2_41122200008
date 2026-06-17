import { Navigate, useParams } from "react-router-dom";

export default function LecturerPreferencesRedirect() {
  const { datasetId } = useParams();
  return <Navigate to={`/datasets/${datasetId}?tab=preferences`} replace />;
}
