import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Member } from '@/hooks/use-members'; // Member 타입 import
import { supabase } from '@/integrations/supabase/client'; // Supabase client import
import { useAuth } from '@/contexts/AuthContext'; // useAuth import

interface ConsultationLocationState {
  selectedMember: Member | null;
  ptSessionId: string | null; // 또는 예약 ID (schedules 테이블의 ID일 수도 있음)
}

const CONSULTATION_TOPICS = [
  { id: 'goal_setting', label: '운동 목표 설정' },
  { id: 'diet_feedback', label: '식단 피드백' },
  { id: 'lifestyle_check', label: '생활 습관 점검' },
  { id: 'program_inquiry', label: '운동 프로그램 문의' },
  { id: 'etc', label: '기타 자유 상담' },
];

export function ConsultationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth(); // 트레이너 ID 가져오기

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [ptSessionId, setPtSessionId] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [consultationNotes, setConsultationNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const state = location.state as ConsultationLocationState | null;
    if (state?.selectedMember) {
      setSelectedMember(state.selectedMember);
    }
    if (state?.ptSessionId) {
      setPtSessionId(state.ptSessionId);
    }
    // 상태 사용 후에는 히스토리에서 제거 (새로고침 시 유지되지 않도록)
    // window.history.replaceState({}, document.title)
  }, [location.state]);

  const handleTopicChange = (topicId: string) => {
    setSelectedTopics((prevTopics) =>
      prevTopics.includes(topicId)
        ? prevTopics.filter((id) => id !== topicId)
        : [...prevTopics, topicId]
    );
  };

  const handleSaveConsultation = async () => {
    if (!selectedMember || !user) {
      toast({ title: "오류", description: "회원 또는 트레이너 정보가 없습니다.", variant: "destructive" });
      return;
    }
    if (selectedTopics.length === 0 && !consultationNotes.trim()) {
      toast({ title: "알림", description: "상담 주제를 선택하거나 메모를 입력해주세요.", variant: "default" });
      return;
    }

    setIsSaving(true);
    try {
      // TODO: 상담 내용을 데이터베이스에 저장하는 로직 추가
      // 예: supabase.from('consultations').insert(...)
      // ptSessionId를 사용하여 pt_sessions 테이블과 연결하거나, 별도의 consultation_logs 테이블 생성 고려
      console.log('상담 내용 저장:', {
        memberId: selectedMember.id, // members 테이블의 id (UUID)
        trainerId: user.id,
        ptSessionId: ptSessionId, // pt_sessions 테이블의 id
        topics: selectedTopics,
        notes: consultationNotes,
        consultationDate: new Date().toISOString(),
      });

      // 임시 저장 성공 토스트
      toast({ title: "성공 (임시)", description: "상담 내용이 임시로 기록되었습니다. (DB 연동 필요)" });
      // 저장 후 이전 페이지로 돌아가거나, 다른 액션 수행
      // navigate(-1); // 이전 페이지로 이동
    } catch (error: any) {
      toast({ title: "저장 오류", description: error.message || "상담 내용 저장 중 오류 발생", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedMember) {
    return (
      <AppLayout>
        <div className="p-4">
          <Card>
            <CardHeader>
              <CardTitle>오류</CardTitle>
            </CardHeader>
            <CardContent>
              <p>상담할 회원 정보가 없습니다. 일정 페이지에서 다시 시도해주세요.</p>
              <Button onClick={() => navigate('/schedule-mobile')} className="mt-4">일정으로 돌아가기</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">상담 기록</CardTitle>
            <CardDescription>
              {selectedMember.name} 회원님과의 상담 내용을 기록합니다.
              {ptSessionId && ` (예약 ID: ${ptSessionId.substring(0,8)}...)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">상담 주제 (다중 선택 가능)</h3>
              <div className="space-y-2">
                {CONSULTATION_TOPICS.map((topic) => (
                  <div key={topic.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`topic-${topic.id}`}
                      checked={selectedTopics.includes(topic.id)}
                      onCheckedChange={() => handleTopicChange(topic.id)}
                    />
                    <Label htmlFor={`topic-${topic.id}`} className="font-normal">
                      {topic.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="consultation-notes" className="text-lg font-semibold mb-2 block">상담 내용 및 메모</Label>
              <Textarea
                id="consultation-notes"
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                placeholder="상담 내용, 회원 피드백, 다음 상담 계획 등을 자유롭게 기록하세요."
                rows={8}
                className="text-base"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => navigate(-1)} disabled={isSaving}>
                취소
              </Button>
              <Button onClick={handleSaveConsultation} disabled={isSaving}>
                {isSaving ? '저장 중...' : '상담 완료 및 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default ConsultationPage;