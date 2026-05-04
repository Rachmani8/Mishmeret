import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 max-w-[430px] mx-auto w-full pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
