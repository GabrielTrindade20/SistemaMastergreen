import { useState, useCallback } from 'react';

export function usePhoneMask() {
  const [value, setValue] = useState('');

  const formatPhone = useCallback((rawValue: string) => {
    const numbers = rawValue.replace(/\D/g, '');
    
    if (numbers.length <= 10) {
      // (xx) xxxx-xxxx
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, (match, p1, p2, p3) => {
        if (p3) return `(${p1}) ${p2}-${p3}`;
        if (p2) return `(${p1}) ${p2}`;
        if (p1) return `(${p1}`;
        return numbers;
      });
    } else {
      // (xx) xxxxx-xxxx
      return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, (match, p1, p2, p3) => {
        if (p3) return `(${p1}) ${p2}-${p3}`;
        if (p2) return `(${p1}) ${p2}`;
        if (p1) return `(${p1}`;
        return numbers;
      });
    }
  }, []);

  const handleChange = useCallback((rawValue: string) => {
    const formatted = formatPhone(rawValue);
    setValue(formatted);
    return formatted;
  }, [formatPhone]);

  return { value, handleChange, setValue };
}

export function useCPFCNPJMask() {
  const [value, setValue] = useState('');

  const formatDocument = useCallback((rawValue: string) => {
    const numbers = rawValue.replace(/\D/g, '');
    
    if (numbers.length <= 11) {
      // CPF: xxx.xxx.xxx-xx
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (match, p1, p2, p3, p4) => {
        if (p4) return `${p1}.${p2}.${p3}-${p4}`;
        if (p3) return `${p1}.${p2}.${p3}`;
        if (p2) return `${p1}.${p2}`;
        return p1;
      });
    } else {
      // CNPJ: xx.xxx.xxx/xxxx-xx
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (match, p1, p2, p3, p4, p5) => {
        if (p5) return `${p1}.${p2}.${p3}/${p4}-${p5}`;
        if (p4) return `${p1}.${p2}.${p3}/${p4}`;
        if (p3) return `${p1}.${p2}.${p3}`;
        if (p2) return `${p1}.${p2}`;
        return p1;
      });
    }
  }, []);

  const handleChange = useCallback((rawValue: string) => {
    const formatted = formatDocument(rawValue);
    setValue(formatted);
    return formatted;
  }, [formatDocument]);

  return { value, handleChange, setValue };
}

export function useCEPMask() {
  const [value, setValue] = useState('');

  const formatCEP = useCallback((rawValue: string) => {
    const numbers = rawValue.replace(/\D/g, '');
    // xxxxx-xxx
    return numbers.replace(/(\d{5})(\d{0,3})/, (match, p1, p2) => {
      if (p2) return `${p1}-${p2}`;
      return p1;
    });
  }, []);

  const handleChange = useCallback((rawValue: string) => {
    const formatted = formatCEP(rawValue);
    setValue(formatted);
    return formatted;
  }, [formatCEP]);

  return { value, handleChange, setValue };
}

export function useCurrencyMask() {
  const [value, setValue] = useState('');

  const formatCurrency = useCallback((rawValue: string) => {
    const numbers = rawValue.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    
    if (isNaN(amount)) return 'R$ 0,00';
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  }, []);

  const handleChange = useCallback((rawValue: string) => {
    const formatted = formatCurrency(rawValue);
    setValue(formatted);
    return formatted;
  }, [formatCurrency]);

  const getRawValue = useCallback(() => {
    return value.replace(/\D/g, '');
  }, [value]);

  return { value, handleChange, setValue, getRawValue };
}