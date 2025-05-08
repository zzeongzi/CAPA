import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ModeToggle } from '@/components/layout/ModeToggle'; // 테마 토글 컴포넌트 import

export function SettingsPage() {
  // TODO: 실제 설정 상태 관리 로직 추가 (useState, useContext 등)
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [pushNotifications, setPushNotifications] = React.useState(false);

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">설정</h1>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>계정</CardTitle>
              <CardDescription>계정 정보를 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* TODO: 계정 관리 기능 구현 (비밀번호 변경 등) */}
              <p className="text-muted-foreground">계정 관리 기능은 아직 구현되지 않았습니다.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>알림</CardTitle>
              <CardDescription>알림 수신 설정을 변경합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notifications">이메일 알림</Label>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="push-notifications">푸시 알림</Label>
                <Switch
                  id="push-notifications"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>테마</CardTitle>
              <CardDescription>애플리케이션 테마를 변경합니다.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="flex items-center justify-between">
                 <Label>라이트/다크 모드</Label>
                 <ModeToggle />
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

export default SettingsPage;