import { Star } from 'lucide-react';
import { useState } from 'react';

interface Props {
  rating: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
}

export function RatingStars({ rating, onChange, readonly = false, size = 14 }: Props) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`transition-transform ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          onClick={() => {
            if (!readonly && onChange) {
              onChange(rating === star ? 0 : star);
            }
          }}
          onMouseEnter={() => { if (!readonly) setHover(star); }}
          onMouseLeave={() => setHover(0)}
        >
          <Star
            size={size}
            fill={(hover || rating) >= star ? '#f59e0b' : 'transparent'}
            color={(hover || rating) >= star ? '#f59e0b' : '#30363d'}
          />
        </button>
      ))}
      {!readonly && (
        <span className="text-[10px] ml-1" style={{ color: '#484f58' }}>
          {hover || rating || 0}/5
        </span>
      )}
    </div>
  );
}
