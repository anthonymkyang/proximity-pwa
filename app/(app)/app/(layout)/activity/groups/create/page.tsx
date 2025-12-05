import { createDraftGroup } from "@/app/api/groups/actions/route";
import Wizard from "@/components/activity/groups/create/Wizard";
import { X } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    id?: string; // existing group id
    step?: string;
  };
};

export default async function CreateGroupPage({ searchParams }: PageProps) {
  const idFromUrl = searchParams?.id?.trim();
  const groupId =
    idFromUrl && idFromUrl.length > 0 ? idFromUrl : await createDraftGroup();

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))] transition-transform duration-300">
      <div className="flex items-center justify-between pb-3">
        <h1 className="text-2xl font-bold tracking-tight">Create group</h1>
        <Link
          href="/app/activity"
          aria-label="Close"
          className="h-9 w-9 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-xl border border-white/20 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 transition-all duration-300 active:scale-110"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>

      <Wizard groupId={groupId} />
    </div>
  );
}
