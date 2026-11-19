export function BrandLogo({ inverted = false, size = 'md' }) {
  const iconDim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        className={`${iconDim} shrink-0`}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          width="36"
          height="36"
          rx="6"
          fill={inverted ? '#13A89E' : '#0B2545'}
        />
        <path
          d="M18 7L27 11.2V18.1C27 23.2 23.1 27.6 18 29.2C12.9 27.6 9 23.2 9 18.1V11.2L18 7Z"
          stroke="#FFFFFF"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M12.2 19.3C13.7 18.1 15.1 18.1 16.5 19.3C17.9 20.5 19.3 20.5 20.8 19.3C21.8 18.5 22.8 18.3 23.8 18.9"
          stroke={inverted ? '#0B2545' : '#13A89E'}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M13.2 22.9C14.5 21.9 15.8 21.9 17.1 22.9C18.3 23.9 19.6 23.9 20.9 22.9C21.6 22.4 22.2 22.2 22.8 22.5"
          stroke="#F28C28"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`font-display font-bold tracking-tight whitespace-nowrap shrink-0 ${textSize} ${
          inverted ? 'text-white' : 'text-[#0B2545]'
        }`}
      >
        FloodConnect
      </span>
    </span>
  );
}
