import { Users } from "lucide-react";

function FriendsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-accent/40 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Users size={32} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-primary">Friends</h1>
      
      </div>
    </div>
  );
}

export default FriendsPage;
