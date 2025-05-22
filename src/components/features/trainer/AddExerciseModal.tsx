import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PlusCircle } from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
}

interface AddExerciseModalProps {
  allExercises: Exercise[];
  onAddExercise: (exerciseId: string) => void;
  isLoadingAllExercises?: boolean;
}

const AddExerciseModal: React.FC<AddExerciseModalProps> = ({ allExercises, onAddExercise, isLoadingAllExercises }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const filteredExercises = allExercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (selectedExerciseId) {
      onAddExercise(selectedExerciseId);
      setSelectedExerciseId(null); // Reset selection
      setSearchTerm(''); // Reset search
      setIsOpen(false); // Close modal
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" /> 운동 선택하여 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>운동 추가</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            type="text"
            placeholder="운동 이름 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          {isLoadingAllExercises ? (
            <p>운동 목록 로딩 중...</p>
          ) : filteredExercises.length === 0 ? (
            <p>검색 결과가 없거나 추가할 운동이 없습니다.</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              {filteredExercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className={`p-2 hover:bg-muted cursor-pointer ${
                    selectedExerciseId === exercise.id ? 'bg-muted font-semibold' : ''
                  }`}
                  onClick={() => setSelectedExerciseId(exercise.id)}
                >
                  {exercise.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">취소</Button>
          </DialogClose>
          <Button type="button" onClick={handleAdd} disabled={!selectedExerciseId}>
            선택한 운동 추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddExerciseModal;
