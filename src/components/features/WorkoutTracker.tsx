
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, Edit, Save, Check } from "lucide-react";

interface Exercise {
  id: number;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  completed: boolean;
}

export function WorkoutTracker() {
  const [exercises, setExercises] = useState<Exercise[]>([
    { id: 1, name: "벤치프레스", sets: 3, reps: 10, weight: 70, completed: false },
    { id: 2, name: "스쿼트", sets: 4, reps: 8, weight: 100, completed: false },
    { id: 3, name: "데드리프트", sets: 3, reps: 8, weight: 120, completed: false },
  ]);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newExerciseName, setNewExerciseName] = useState("");
  
  const handleAddExercise = () => {
    if (!newExerciseName.trim()) return;
    
    const newExercise: Exercise = {
      id: Date.now(),
      name: newExerciseName,
      sets: 3,
      reps: 10,
      weight: 20,
      completed: false,
    };
    
    setExercises([...exercises, newExercise]);
    setNewExerciseName("");
  };
  
  const handleDeleteExercise = (id: number) => {
    setExercises(exercises.filter(exercise => exercise.id !== id));
  };
  
  const handleToggleComplete = (id: number) => {
    setExercises(
      exercises.map(exercise => 
        exercise.id === id 
          ? { ...exercise, completed: !exercise.completed } 
          : exercise
      )
    );
  };
  
  const handleEditExercise = (id: number) => {
    setEditingId(id);
  };
  
  const handleSaveEdit = (id: number) => {
    setEditingId(null);
  };
  
  const handleValueChange = (id: number, field: keyof Exercise, value: number) => {
    setExercises(
      exercises.map(exercise => 
        exercise.id === id 
          ? { ...exercise, [field]: value } 
          : exercise
      )
    );
  };
  
  return (
    <Card className="w-full glass-card">
      <CardHeader>
        <CardTitle>오늘의 운동 루틴</CardTitle>
        <CardDescription>2025년 4월 14일 (월) - 김민지 회원</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center mb-6 gap-2">
          <Input
            placeholder="운동 추가..."
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={handleAddExercise}
            disabled={!newExerciseName.trim()}
            className="bg-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            추가
          </Button>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>운동</TableHead>
              <TableHead className="text-center">세트</TableHead>
              <TableHead className="text-center">횟수</TableHead>
              <TableHead className="text-center">무게 (kg)</TableHead>
              <TableHead className="text-center">상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercises.map((exercise) => (
              <TableRow key={exercise.id}>
                <TableCell className="font-medium">{exercise.name}</TableCell>
                <TableCell className="text-center">
                  {editingId === exercise.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleValueChange(
                          exercise.id, 
                          'sets', 
                          Math.max(1, exercise.sets - 1)
                        )}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span>{exercise.sets}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleValueChange(
                          exercise.id, 
                          'sets', 
                          exercise.sets + 1
                        )}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    exercise.sets
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === exercise.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleValueChange(
                          exercise.id, 
                          'reps', 
                          Math.max(1, exercise.reps - 1)
                        )}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span>{exercise.reps}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleValueChange(
                          exercise.id, 
                          'reps', 
                          exercise.reps + 1
                        )}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    exercise.reps
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === exercise.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleValueChange(
                          exercise.id, 
                          'weight', 
                          Math.max(0, exercise.weight - 5)
                        )}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span>{exercise.weight}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleValueChange(
                          exercise.id, 
                          'weight', 
                          exercise.weight + 5
                        )}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    exercise.weight
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant={exercise.completed ? "default" : "outline"}
                    size="sm"
                    className={exercise.completed ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => handleToggleComplete(exercise.id)}
                  >
                    {exercise.completed ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        완료
                      </>
                    ) : (
                      "진행 중"
                    )}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  {editingId === exercise.id ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSaveEdit(exercise.id)}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditExercise(exercise.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteExercise(exercise.id)}
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
