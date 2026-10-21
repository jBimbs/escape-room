import { Suspense } from "react";
import TeamScreen from "@/components/TeamScreen";
async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamScreen id={id} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="kiosk"><p className="note">Loading…</p></main>}>
      <Inner params={params} />
    </Suspense>
  );
}