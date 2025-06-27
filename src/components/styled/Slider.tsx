import styled from 'styled-components';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  style?: React.CSSProperties;
}

const SliderContainer = styled.div`
  position: relative;
  width: 100%;
  height: 1.25rem;
  display: flex;
  align-items: center;
`;

const SliderTrack = styled.div`
  position: relative;
  height: 2px;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.gray[600]};
  border-radius: 1px;
  overflow: hidden;
`;

const SliderRange = styled.div<{ percentage: number }>`
  position: absolute;
  height: 100%;
  background-color: ${({ theme }) => theme.colors.primary};
  width: ${({ percentage }) => percentage}%;
`;

const SliderThumb = styled.div<{ percentage: number }>`
  position: absolute;
  left: ${({ percentage }) => percentage}%;
  transform: translateX(-50%);
  width: 1rem;
  height: 1rem;
  background-color: ${({ theme }) => theme.colors.primary};
  border: 2px solid ${({ theme }) => theme.colors.white};
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s ease;
  
  &:hover {
    transform: translateX(-50%) scale(1.1);
  }
`;

const SliderInput = styled.input`
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
`;

export const Slider: React.FC<SliderProps> = ({ 
  value, 
  onValueChange, 
  min = 0, 
  max = 100, 
  step = 1, 
  style 
}) => {
  const currentValue = value[0] || 0;
  const percentage = ((currentValue - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    onValueChange([newValue]);
  };

  return (
    <SliderContainer style={style}>
      <SliderTrack>
        <SliderRange percentage={percentage} />
      </SliderTrack>
      <SliderThumb percentage={percentage} />
      <SliderInput
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={handleChange}
      />
    </SliderContainer>
  );
};