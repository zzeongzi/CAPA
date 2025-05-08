import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, X, File as FileIcon, Loader2, Image, Video, Play, Camera, FolderOpen } from 'lucide-react'; // Play, Camera, FolderOpen 추가
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'; // DropdownMenu 추가
import { cn } from '@/lib/utils'; // cn 추가

// Prop 타입 변경
interface MediaUploaderProps {
  workoutExerciseId: string;
  onFileSelect: (file: File, localUrl: string, thumbnailUrl?: string) => void;
  onFileRemove: (localUrlOrStoragePath: string) => void;
  initialMedia?: { file?: File, localUrl?: string, thumbnailUrl?: string, storagePath?: string, fileName?: string, mimeType?: string }[];
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
  workoutExerciseId,
  onFileSelect,
  onFileRemove,
  initialMedia = [],
}) => {
  // 각 파일 타입별 input ref 유지 (촬영/선택 구분)
  const imageCaptureInputRef = useRef<HTMLInputElement>(null);
  const imageSelectInputRef = useRef<HTMLInputElement>(null);
  const videoCaptureInputRef = useRef<HTMLInputElement>(null);
  const videoSelectInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // 썸네일 생성 중 상태만 유지
  const [generatingThumbnail, setGeneratingThumbnail] = useState<Record<string, boolean>>({});

  // 비디오 썸네일 생성 함수 (동일)
  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const url = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const aspectRatio = video.videoWidth / video.videoHeight;
        const maxWidth = 200;
        canvas.width = maxWidth;
        canvas.height = maxWidth / aspectRatio;
        video.currentTime = 0.1;
      };

      video.onseeked = () => {
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(url);
          resolve(thumbnailUrl);
        } else {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context not available'));
        }
      };

      video.onerror = (e) => {
        URL.revokeObjectURL(url);
        console.error("Error loading video for thumbnail generation:", e);
        reject(new Error('Failed to load video metadata'));
      };

      video.src = url;
      video.load();
    });
  };


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const localUrl = URL.createObjectURL(file); // 로컬 URL은 계속 생성

      let thumbnailUrl: string | undefined = undefined;
      if (file.type.startsWith('video/')) {
        setGeneratingThumbnail(prev => ({ ...prev, [localUrl]: true })); // 생성 시작 표시
        try {
          thumbnailUrl = await generateVideoThumbnail(file);
        } catch (err) {
          console.error("Error generating video thumbnail:", err);
          toast({ title: "오류", description: "비디오 썸네일 생성 실패", variant: "destructive" });
        } finally {
          setGeneratingThumbnail(prev => ({ ...prev, [localUrl]: false })); // 생성 완료/실패 표시
        }
      }

      onFileSelect(file, localUrl, thumbnailUrl); // 파일, 로컬 URL, 썸네일 URL 전달

      event.target.value = ""; // input 값 초기화
    }
  };

  // 각 파일 타입 및 방식별 input 트리거 함수
  const triggerImageCapture = () => imageCaptureInputRef.current?.click();
  const triggerImageSelect = () => imageSelectInputRef.current?.click();
  const triggerVideoCapture = () => videoCaptureInputRef.current?.click();
  const triggerVideoSelect = () => videoSelectInputRef.current?.click();

  // 로컬 URL 해제 로직 제거 (부모 컴포넌트에서 관리)

  return (
    <div className="space-y-2 mt-2">
      {/* 파일 선택 버튼 그룹 (DropdownMenu 사용) */}
      <div className="flex items-center gap-2">
        {/* 사진 버튼 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Image className="mr-2 h-4 w-4" /> 사진
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={triggerImageCapture}>
              <Camera className="mr-2 h-4 w-4" /> 사진 촬영
            </DropdownMenuItem>
            <DropdownMenuItem onClick={triggerImageSelect}>
              <FolderOpen className="mr-2 h-4 w-4" /> 사진 선택
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* 숨겨진 Input 요소들 */}
        <Input ref={imageCaptureInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        <Input ref={imageSelectInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        {/* 동영상 버튼 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Video className="mr-2 h-4 w-4" /> 동영상
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={triggerVideoCapture}>
              <Camera className="mr-2 h-4 w-4" /> 동영상 촬영
            </DropdownMenuItem>
            <DropdownMenuItem onClick={triggerVideoSelect}>
              <FolderOpen className="mr-2 h-4 w-4" /> 동영상 선택
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* 숨겨진 Input 요소들 */}
        <Input ref={videoCaptureInputRef} type="file" accept="video/*" capture="environment" onChange={handleFileChange} className="hidden" />
        <Input ref={videoSelectInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
      </div>

      {/* 업로드된/선택된 파일 목록 및 미리보기/재생 */}
      {/* initialMedia prop을 직접 사용하여 목록 렌더링 */}
      {initialMedia.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">첨부된 미디어:</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {initialMedia.map((media) => {
              const isLocal = !!media.file;
              // 썸네일 URL 결정: 로컬 썸네일 > 스토리지 썸네일(추후 구현 시) > 로컬 URL(이미지) > 스토리지 URL(이미지)
              const thumbnailUrl = media.thumbnailUrl || (media.mimeType?.startsWith('image/') ? (media.localUrl || supabase.storage.from('workoutmedia').getPublicUrl(media.storagePath || '').data?.publicUrl?.replace('/public', '')) : undefined);
              // 미리보기/재생용 URL 결정: 로컬 URL > 스토리지 URL
              const previewUrl = media.localUrl || supabase.storage.from('workoutmedia').getPublicUrl(media.storagePath || '').data?.publicUrl?.replace('/public', '');
              const key = media.localUrl || media.storagePath || media.fileName || `media-${Math.random()}`; // 고유 key 확보 강화
              const fileName = media.file?.name || media.fileName;
              const mimeType = media.file?.type || media.mimeType;
              const isGenerating = media.localUrl && generatingThumbnail[media.localUrl];

              if (!previewUrl) return null; // 미리보기 URL 없으면 렌더링 안 함

              return (
                <Dialog key={key}>
                  <DialogTrigger asChild>
                    <div className="relative aspect-square rounded-md overflow-hidden cursor-pointer group border">
                      {mimeType?.startsWith('image/') ? (
                        <img src={thumbnailUrl || previewUrl} alt={fileName} className="object-cover w-full h-full" />
                      ) : mimeType?.startsWith('video/') ? (
                        thumbnailUrl ? (
                          /* 비디오 썸네일 표시 및 재생 아이콘 오버레이 */
                          <div className="relative w-full h-full">
                            <img src={thumbnailUrl} alt={`${fileName} thumbnail`} className="object-cover w-full h-full" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                              <Play className="h-8 w-8 text-white" />
                            </div>
                          </div>
                        ) : isGenerating ? (
                          <div className="w-full h-full bg-black flex items-center justify-center">
                            <Loader2 className="h-6 w-6 text-white animate-spin" />
                          </div>
                        ) : (
                          /* 썸네일 생성 전 또는 실패 시 기본 비디오 아이콘 및 재생 아이콘 */
                          <div className="relative w-full h-full bg-black flex items-center justify-center">
                            <Video className="h-8 w-8 text-white opacity-50" />
                            <div className="absolute inset-0 flex items-center justify-center">
                               <Play className="h-8 w-8 text-white" />
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <FileIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {/* 삭제 버튼 */}
                      <Button
                        size="icon"
                        className="absolute top-1 right-1 h-5 w-5 z-10 rounded-full border border-purple-600 bg-transparent text-purple-600 hover:bg-purple-100 hover:scale-110 transition-all duration-150" // 크기 축소(h-5 w-5), hover 시 배경색 및 확대 효과 추가
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileRemove(media.localUrl || media.storagePath || ''); // key 전달
                        }}
                      >
                        <X className="h-3 w-3" /> {/* 아이콘 크기 축소 */}
                      </Button>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogTitle className="sr-only">{fileName}</DialogTitle>
                    {mimeType?.startsWith('image/') && (
                      <img src={previewUrl} alt={fileName} className="max-w-full max-h-[80vh] mx-auto" />
                    )}
                    {mimeType?.startsWith('video/') && (
                      <video controls src={previewUrl} className="max-w-full max-h-[80vh] mx-auto">
                        Your browser does not support the video tag.
                      </video>
                    )}
                    {!mimeType?.startsWith('image/') && !mimeType?.startsWith('video/') && (
                      <p className="text-center p-4">이 파일 형식은 미리보기를 지원하지 않습니다.</p>
                    )}
                  </DialogContent>
                </Dialog>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaUploader;