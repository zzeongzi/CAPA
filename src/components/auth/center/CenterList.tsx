
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, MapPinned, Phone } from "lucide-react";
import { KakaoPlace } from "@/types/kakao";

interface CenterListProps {
  isSearching: boolean;
  searchResults: KakaoPlace[];
  onSelectPlace: (place: KakaoPlace) => void;
}

export const CenterList = ({ isSearching, searchResults, onSelectPlace }: CenterListProps) => {
  if (isSearching) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">검색 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (searchResults.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">검색 결과가 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {searchResults.map((place) => (
        <Card
          key={place.id}
          className="cursor-pointer hover:shadow-md transition-all mb-2"
          onClick={() => onSelectPlace(place)}
        >
          <CardContent className="p-4 flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <MapPinned className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{place.place_name}</h3>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 mr-1" />
                <span>{place.road_address_name || place.address_name}</span>
              </div>
              {place.phone && (
                <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <Phone className="h-3 w-3 mr-1" />
                  <span>{place.phone}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
