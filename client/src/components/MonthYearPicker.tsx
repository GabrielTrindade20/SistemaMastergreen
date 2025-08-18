import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthYearPickerProps {
  value: string; // Format: "YYYY-MM"
  onChange: (value: string) => void;
  className?: string;
}

export function MonthYearPicker({ value, onChange, className = "" }: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const [year, month] = value.split('-').map(Number);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  
  // Generate year options (last 5 years + next 2 years)
  const yearOptions = [];
  for (let i = currentYear - 5; i <= currentYear + 2; i++) {
    yearOptions.push(i);
  }

  // Month names in Portuguese
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handleMonthChange = (newMonth: string) => {
    const newValue = `${year}-${String(newMonth).padStart(2, '0')}`;
    onChange(newValue);
    setIsOpen(false);
  };

  const handleYearChange = (newYear: string) => {
    const newValue = `${newYear}-${String(month).padStart(2, '0')}`;
    onChange(newValue);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentDate = new Date(year, month - 1);
    
    if (direction === 'prev') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    const newYear = currentDate.getFullYear();
    const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    onChange(`${newYear}-${newMonth}`);
  };

  const getMonthName = (dateStr: string) => {
    const [year, month] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Navigation buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigateMonth('prev')}
        className="p-2 h-auto"
        data-testid="button-prev-month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Month/Year Picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[180px] md:w-[220px] justify-center gap-2"
            data-testid="button-month-picker"
          >
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="font-medium">
              {getMonthName(value).charAt(0).toUpperCase() + getMonthName(value).slice(1)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="center">
          <div className="space-y-4">
            <div className="text-sm font-medium text-center">Selecionar Mês e Ano</div>
            
            {/* Year selector */}
            <div>
              <label className="text-sm font-medium text-gray-700">Ano</label>
              <Select value={year.toString()} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((yearOption) => (
                    <SelectItem key={yearOption} value={yearOption.toString()}>
                      {yearOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month grid */}
            <div>
              <label className="text-sm font-medium text-gray-700">Mês</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {monthNames.map((monthName, index) => {
                  const monthNumber = index + 1;
                  const isSelected = monthNumber === month;
                  
                  return (
                    <Button
                      key={monthNumber}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleMonthChange(monthNumber.toString())}
                      className="text-xs"
                    >
                      {monthName.slice(0, 3)}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Navigation buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigateMonth('next')}
        className="p-2 h-auto"
        data-testid="button-next-month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}