// src/components/features/dashboard/RecentBodyCompositionsCard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Scale, ChevronRight } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { fetchRecentBodyCompositions, BodyComposition } from '@/lib/dashboardQueries';

const ITEMS_PER_COMPOSITION_CARD = 2;

// Helper function, can be moved to utils if used elsewhere
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "날짜 없음";
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return "날짜 오류";
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) { console.error("Error formatting date:", dateString, e); return "날짜 오류"; }
};

const RecentBodyCompositionsCard = () => {
  const navigate = useNavigate();
  const { userCenter } = useAuth();
  const { toast } = useToast();
  const [compositionCurrentPage, setCompositionCurrentPage] = useState(1);

  const { data: allCompositions = [], isLoading, error } = useQuery<BodyComposition[], Error>({
    queryKey: ['dashboard', 'recentBodyCompositions', userCenter],
    queryFn: () => fetchRecentBodyCompositions(userCenter),
    enabled: !!userCenter,
    onError: (err) => {
      toast({
        title: "오류",
        description: `최근 체성분 분석 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });

  if (error) {
    // Error is handled by toast
  }

  const paginatedCompositions = allCompositions.slice((compositionCurrentPage - 1) * ITEMS_PER_COMPOSITION_CARD, compositionCurrentPage * ITEMS_PER_COMPOSITION_CARD);
  const totalCompositionPages = Math.ceil(allCompositions.length / ITEMS_PER_COMPOSITION_CARD);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">최근 체성분 분석</CardTitle>
          </div>
          <CardDescription>가장 최근 측정된 회원 체성분 기록</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/measurements/history')}>
          모든 측정 기록 보기 <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="w-full space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : paginatedCompositions.length > 0 ? (
          <>
            <div className="space-y-4">
              {paginatedCompositions.map((composition) => (
                <div key={composition.id} className="space-y-2 border-b pb-2 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={composition.members?.profile_image_url || undefined} />
                        <AvatarFallback>{composition.members?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{composition.members?.name || '알 수 없는 회원'}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatDate(composition.measurement_date)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between"> <span>체중:</span> <span className="font-medium">{composition.weight_kg?.toFixed(1) ?? '-'} kg</span> </div>
                    <div className="flex justify-between"> <span>골격근량:</span> <span className="font-medium">{composition.skeletal_muscle_mass_kg?.toFixed(1) ?? '-'} kg</span> </div>
                    <div className="flex justify-between"> <span>체지방률:</span> <span className="font-medium">{composition.body_fat_percentage?.toFixed(1) ?? '-'} %</span> </div>
                    <div className="flex justify-between"> <span>BMI:</span> <span className="font-medium">{composition.bmi?.toFixed(1) ?? '-'}</span> </div>
                  </div>
                </div>
              ))}
            </div>
            {totalCompositionPages > 1 && (
              <div className="mt-4 flex justify-center items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setCompositionCurrentPage(p => Math.max(1, p - 1))} disabled={compositionCurrentPage === 1}>이전</Button>
                <span className="text-sm text-muted-foreground">{compositionCurrentPage} / {totalCompositionPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCompositionCurrentPage(p => Math.min(totalCompositionPages, p + 1))} disabled={compositionCurrentPage === totalCompositionPages}>다음</Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Scale className="h-10 w-10 mb-2 opacity-20" />
            <p>최근 측정된 체성분 데이터가 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentBodyCompositionsCard;
