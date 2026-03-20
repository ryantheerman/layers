import { Text } from 'react-konva';

interface Props {
  text: string;
  x: number;
  y: number;
}

export default function TextLabel({ text, x, y }: Props) {
  return (
    <Text
      text={text}
      x={x - 20}
      y={y - 18}
      fontSize={11}
      fontFamily="'Inter', 'Segoe UI', sans-serif"
      fill="#a09c94"
      listening={false}
    />
  );
}
