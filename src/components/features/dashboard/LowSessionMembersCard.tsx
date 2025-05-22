// src/components/features/dashboard/LowSessionMembersCard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { AlertTriangle } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { fetchLowSessionMembers, LowSessionMember } from '@/lib/dashboardQueries';


const LowSessionMembersCard = () => {
  const navigate = useNavigate();
  const { userCenter } = useAuth();
  const { toast } = useToast();

  const { data: lowSessionMembers = [], isLoading, error } = useQuery<LowSessionMember[], Error>({
    queryKey: ['dashboard', 'lowSessionMembers', userCenter],
    queryFn: () => fetchLowSessionMembers(userCenter),
    enabled: !!userCenter,
    onError: (err) => {
      toast({
        title: "오류",
        description: `만료 예정 회원 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });
  
  if (error) {
    // Error is handled by toast
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <CardTitle className="text-sm font-medium">만료 예정 회원</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : lowSessionMembers.length > 0 ? (
          <>
            <Carousel
              opts={{ align: "start", loop: lowSessionMembers.length > 1 }} // Loop only if more than 1 item
              className="w-full max-w-xs mx-auto"
            >
              <CarouselContent className="-ml-1">
                {lowSessionMembers.map((item) => (
                  <CarouselItem key={item.membership_id} className="pl-1 basis-full">
                    <div className="p-1">
                      <div className="flex items-center justify-between text-sm bg-muted p-3 rounded-md">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={item.member.profile_image_url || undefined} />
                            <AvatarFallback>{item.member.name?.[0]}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate">{item.member.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {item.remaining_sessions} / {item.total_sessions}회
                        </Badge>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {lowSessionMembers.length > 1 && (
                <>
                  <CarouselPrevious className="absolute left-[-10px] top-1/2 -translate-y-1/2" />
                  <CarouselNext className="absolute right-[-10px] top-1/2 -translate-y-1/2" />
                </>
              )}
            </Carousel>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto mt-2 text-xs w-full justify-end"
              onClick={() => navigate('/members?filter=low_sessions')}
            >
              전체 명단 보기
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">만료 예정 회원이 없습니다.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default LowSessionMembersCard;
