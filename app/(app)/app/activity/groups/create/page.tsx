import { createDraftGroup } from "@/app/api/groups/actions/route";
import Wizard from "@/components/activity/groups/create/Wizard";
import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import { X } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    gid?: string;
  };
};

export default async function CreateGroupPage({ searchParams }: PageProps) {
  const gidFromUrl = searchParams?.gid?.trim();
  const groupId =
    gidFromUrl && gidFromUrl.length > 0 ? gidFromUrl : await createDraftGroup();

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))] transition-transform duration-300">
      {/* Top bar with back button */}
      <TopBar
        leftContent={<BackButton useWizardNavigation />}
        rightContent={
          <Link
            href="/app/activity"
            aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-xl border border-white/20 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.6),0_2px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 transition-all duration-300 active:scale-110"
          >
            <X className="h-4 w-4" />
          </Link>
        }
      />

      {/* Small spacer so content doesn't sit under the TopBar */}
      <div className="h-2" />

      {/* Wizard body */}
      <Wizard groupId={groupId} />
    </div>
  );
}
