import React, { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction } from 'react';

// 회원 등록 과정에서 수집할 정보 타입 정의
interface NewMemberData {
  // 단계 1: 기본 정보
  name?: string;
  email?: string;
  password?: string;
  // 단계 2: 추가 프로필 정보
  avatarFile?: File | null; // 프로필 이미지 파일
  avatarUrl?: string; // Storage에 업로드된 URL
  phoneNumber?: string;
  birthDate?: string; // YYYY-MM-DD 형식
  gender?: 'male' | 'female' | 'other';
  // 단계 3: 역할
  role?: 'member' | 'trainer'; // 또는 다른 역할
  // 단계 4: 센터
  centerId?: string;
}

// Context 타입 정의
interface NewMemberContextType {
  memberData: NewMemberData;
  setMemberData: Dispatch<SetStateAction<NewMemberData>>;
  resetMemberData: () => void; // 상태 초기화 함수
}

// Context 생성 (기본값 undefined)
const NewMemberContext = createContext<NewMemberContextType | undefined>(undefined);

// Context Provider 컴포넌트
interface NewMemberProviderProps {
  children: ReactNode;
}

export const NewMemberProvider: React.FC<NewMemberProviderProps> = ({ children }) => {
  const [memberData, setMemberData] = useState<NewMemberData>({});

  // 상태 초기화 함수
  const resetMemberData = () => {
    setMemberData({});
  };

  return (
    <NewMemberContext.Provider value={{ memberData, setMemberData, resetMemberData }}>
      {children}
    </NewMemberContext.Provider>
  );
};

// Context 사용을 위한 커스텀 훅
export const useNewMember = (): NewMemberContextType => {
  const context = useContext(NewMemberContext);
  if (context === undefined) {
    throw new Error('useNewMember must be used within a NewMemberProvider');
  }
  return context;
};