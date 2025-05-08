import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from "@/lib/utils";
import type { SalaryReportRow } from '@/lib/revenueUtils';

interface EditSalaryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  rowData: SalaryReportRow | null;
  onSave: (updatedData: Partial<SalaryReportRow>) => void;
}

export const EditSalaryDetailModal: React.FC<EditSalaryDetailModalProps> = ({
  isOpen,
  onClose,
  rowData,
  onSave,
}) => {
  const [contractDate, setContractDate] = useState<Date | undefined>(undefined);
  const [commissionRate, setCommissionRate] = useState<string>('');
  const [sessionPrice, setSessionPrice] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (rowData) {
      setContractDate(rowData.contractDate ? parseISO(rowData.contractDate) : undefined);
      setCommissionRate(rowData.contractualCommissionRate?.toString() ?? '');
      setSessionPrice(rowData.sessionPrice?.toString() ?? '');
    } else {
      setContractDate(undefined);
      setCommissionRate('');
      setSessionPrice('');
    }
  }, [rowData]);

  const handleSaveClick = () => {
    if (!rowData) return;
    setIsSaving(true);

    const updatedData: Partial<SalaryReportRow> = {
      membershipId: rowData.membershipId,
      contractDate: contractDate ? format(contractDate, 'yyyy-MM-dd') : null,
      contractualCommissionRate: commissionRate !== '' ? parseFloat(commissionRate) : null,
      sessionPrice: sessionPrice !== '' ? parseFloat(sessionPrice) : null,
    };
    onSave(updatedData);
    // setIsSaving(false); // This will be handled by onClose or parent component
  };
  
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
        const numValue = parseFloat(value);
        if (value === '' || (numValue >= 0 && numValue <= 100)) {
            setCommissionRate(value);
        } else if (numValue > 100) {
            setCommissionRate('100');
        } else if (numValue < 0) {
            setCommissionRate('0');
        }
    } else if (value === '') {
        setCommissionRate('');
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) || value === '') {
        setSessionPrice(value);
    }
  };

  if (!isOpen || !rowData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>월급 내역 수정</DialogTitle>
          <DialogDescription>
            {rowData.memberName} 회원의 계약일, 수업료(%), 세션단가를 수정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="modal-contract-date" className="text-right">
              계약일
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "col-span-3 justify-start text-left font-normal",
                    !contractDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {contractDate ? format(contractDate, "yyyy-MM-dd") : <span>날짜 선택</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={contractDate}
                  onSelect={setContractDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="modal-commission-rate" className="text-right">
              수업료(%)
            </Label>
            <Input
              id="modal-commission-rate"
              type="number"
              value={commissionRate}
              onChange={handleRateChange}
              className="col-span-3"
              placeholder="예: 50"
              min="0"
              max="100"
              step="0.1"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="modal-session-price" className="text-right">
              세션단가
            </Label>
            <Input
              id="modal-session-price"
              type="number"
              value={sessionPrice}
              onChange={handlePriceChange}
              className="col-span-3"
              placeholder="예: 70000"
              min="0"
              step="1000"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">취소</Button>
          </DialogClose>
          <Button onClick={handleSaveClick} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};