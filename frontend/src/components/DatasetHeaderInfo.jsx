import { Link } from "react-router-dom";
import { Eye } from "lucide-react";

export default function DatasetHeaderInfo({ datasetId, datasetName }) {
  if (!datasetId) return null;

  return (
    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
      <span>
        Dataset:{" "}
        <span className="font-medium text-foreground">
          {datasetName ?? `#${datasetId}`}
        </span>
      </span>
    </p>
  );
}
