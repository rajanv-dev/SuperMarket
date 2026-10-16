import clsx from 'clsx';

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
  xl: 'w-16 h-16 border-4',
};

export default function LoadingSpinner({ size = 'md', className = '' }) {
  return (
    <div
      className={clsx(
        'rounded-full border-primary-200 border-t-primary-500 animate-spin',
        sizes[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
