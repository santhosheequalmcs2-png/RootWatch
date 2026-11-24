import { useApp } from '../i18n/LanguageContext';

interface BrandLogoProps {
  compact?: boolean;
  lightText?: boolean;
}

export function BrandLogo({ compact = false, lightText = false }: BrandLogoProps) {
  const { t } = useApp();
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="32"
          height="32"
          rx="8"
          className={lightText ? 'fill-[#1F5A39]' : 'fill-[#153625] dark:fill-[#24593C]'}
        />
        {/* Soil horizon line */}
        <line
          x1="6"
          y1="16"
          x2="26"
          y2="16"
          stroke="#9EE6B8"
          strokeOpacity="0.45"
          strokeWidth="1.2"
        />
        {/* Above-soil twin leaves */}
        <path
          d="M16 16V10M16 11C16 8.2 18.8 6.5 22 7C21.6 10.2 19.2 12 16 11.8M16 12.2C16 9.5 13.3 7.8 10.2 8.2C10.6 11.2 12.9 12.8 16 12.6"
          stroke="#7BE0A2"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Below-soil branching root network */}
        <path
          d="M16 16V25M16 18.5L11.5 22.8M16 19.5L20.8 23.5M16 22L13.2 25.5M16 22.5L19 25.5"
          stroke="#F0E5C8"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span
          className={`font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0 ${
            lightText ? 'text-white' : 'text-[#122B1E] dark:text-[#EDF4EF]'
          }`}
        >
          {t('brand_name')}
        </span>
      )}
    </span>
  );
}
