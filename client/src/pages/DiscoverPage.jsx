import { Search } from "lucide-react";

function DiscoverPage() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-accent/40 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
        <Search size={32} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-primary">Discover</h1>
       
      </div>
    </div>
  );
}

export default DiscoverPage;
