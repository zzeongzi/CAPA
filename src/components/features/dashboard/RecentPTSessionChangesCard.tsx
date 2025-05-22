// src/components/features/dashboard/RecentPTSessionChangesCard.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListChecks, ListTodo } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { fetchPTSessionChanges, PTSessionChangeLog } from '@/lib/dashboardQueries';

const ITEMS_PER_LOG_CARD = 4;

const RecentPTSessionChangesCard = () => {
  const { userCenter } = useAuth();
  const { toast } = useToast();
  const [ptLogCurrentPage, setPtLogCurrentPage] = useState(1);

  const { data: ptSessionChangeLogs = [], isLoading, error } = useQuery<PTSessionChangeLog[], Error>({
    queryKey: ['dashboard', 'ptSessionChanges', userCenter],
    queryFn: () => fetchPTSessionChanges(userCenter),
    enabled: !!userCenter,
    onError: (err) => {
      toast({
        title: "오류",
        description: `PT 세션 변경 로그 로딩 중 오류: ${err.message}`,
        variant: "destructive",
      });
    }
  });

  if (error) {
    // Error is handled by toast
  }

  const paginatedLogs = ptSessionChangeLogs.slice((ptLogCurrentPage - 1) * ITEMS_PER_LOG_CARD, ptLogCurrentPage * ITEMS_PER_LOG_CARD);
  const totalPages = Math.ceil(ptSessionChangeLogs.length / ITEMS_PER_LOG_CARD);

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">최근 PT 횟수 변경</CardTitle>
        </div>
        <CardDescription>최근 PT 횟수 변경 기록</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="w-full space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : paginatedLogs.length > 0 ? (
          <>
            <div className="space-y-4">
              {paginatedLogs.map((log) => (
                <div key={log.id} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={log.members?.profile_image_url || undefined} />
                      <AvatarFallback>{log.members?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{log.members?.name || '알 수 없는 회원'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(log.created_at), 'yyyy.MM.dd HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      총 {log.previous_total_sessions}회 → {log.new_total_sessions}회
                    </p>
                    <p className={`text-xs ${log.change_amount > 0 ? 'text-green-500' : log.change_amount < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      ({log.change_amount > 0 ? '+' : ''}{log.change_amount}회)
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setPtLogCurrentPage(p => Math.max(1, p - 1))} disabled={ptLogCurrentPage === 1}>이전</Button>
                <span className="text-sm text-muted-foreground">{ptLogCurrentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPtLogCurrentPage(p => Math.min(totalPages, p + 1))} disabled={ptLogCurrentPage === totalPages}>다음</Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <ListTodo className="h-10 w-10 mb-2 opacity-20" />
            <p>최근 PT 횟수 변경 기록이 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentPTSessionChangesCard;
