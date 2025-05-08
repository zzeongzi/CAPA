
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CenterSearchInputProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const CenterSearchInput = ({ searchQuery, setSearchQuery }: CenterSearchInputProps) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        placeholder="피트니스 센터 검색 또는 주소 검색..."
        className="pl-10"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
};
