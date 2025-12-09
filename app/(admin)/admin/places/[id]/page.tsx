"use client";

import { useParams } from "next/navigation";
import PlaceEditForm from "@/components/map/PlaceEditForm";

export default function EditPlacePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params?.id[0] : (params?.id as string);

  if (!id) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Missing place id in URL.
      </div>
    );
  }

  return (
    <div className="p-6">
      <PlaceEditForm placeId={id} />
    </div>
  );
}
