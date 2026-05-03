const cn = (...classes) => classes.filter(Boolean).join(' ');

const VARIANT_STYLES = {
  primary: {
    light: 'bg-amber-100 text-amber-700',
    solid: 'bg-amber-600 text-white',
  },
  secondary: {
    light: 'bg-gray-100 text-gray-700',
    solid: 'bg-gray-600 text-white',
  },
  success: {
    light: 'bg-green-100 text-green-700',
    solid: 'bg-green-600 text-white',
  },
  warning: {
    light: 'bg-yellow-100 text-yellow-700',
    solid: 'bg-yellow-500 text-white',
  },
  danger: {
    light: 'bg-red-100 text-red-700',
    solid: 'bg-red-600 text-white',
  },
};

export default function Badge({ children, className, variant = 'primary', appearance = 'light' }) {
  const styles = VARIANT_STYLES[variant]?.[appearance] ?? VARIANT_STYLES.primary.light;
  return (
    <span className={cn(
      'inline-flex items-center justify-center border border-transparent font-medium rounded-md px-2 h-5 text-xs',
      styles,
      className
    )}>
      {children}
    </span>
  );
}
