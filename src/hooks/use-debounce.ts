import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  // 디바운스된 값을 저장하기 위한 상태
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // value가 변경된 후 delay 시간(ms)이 지나면 debouncedValue를 업데이트
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 다음 effect가 실행되거나 컴포넌트가 언마운트될 때 타이머를 클리어
    // 이렇게 하면 delay 시간 내에 value가 다시 변경되면 이전 타이머는 취소됨
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // value나 delay가 변경될 때만 effect를 다시 실행

  return debouncedValue;
}

export default useDebounce;
