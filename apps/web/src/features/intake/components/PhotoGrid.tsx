import type { IntakeItem } from '../intake-reducer';
import { PhotoTile } from './PhotoTile';

interface PhotoGridProps {
  items: IntakeItem[];
  label: string;
  onRemove: (key: string) => void;
}

export function PhotoGrid({ items, label, onRemove }: PhotoGridProps) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 sm:gap-x-8 xl:grid-cols-4"
    >
      {items.map((item) => (
        <PhotoTile key={item.key} item={item} onRemove={onRemove} />
      ))}
    </ul>
  );
}
