import type { ReactNode, SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlaneIcon = () => (
  <Icon>
    <path d="M12 2.5c.9 0 1.4 1.1 1.4 2.4v4.7l7.6 4.5v1.8l-7.6-2.4v5.1l2.4 1.8v1.4L12 21l-3.8.9v-1.4l2.4-1.8v-5.1L3 16v-1.8l7.6-4.5V4.9c0-1.3.5-2.4 1.4-2.4z" />
  </Icon>
);

export const JetIcon = () => (
  <Icon>
    <path d="M12 2l2 6 7 6v2l-7-2-1 5 2 2v1l-3-1-3 1v-1l2-2-1-5-7 2v-2l7-6z" />
  </Icon>
);

export const GlobeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </Icon>
);

export const QuakeIcon = () => (
  <Icon>
    <path d="M2 12h4l2-5 3 10 3-8 2 3h6" />
  </Icon>
);

export const SatelliteIcon = () => (
  <Icon>
    <path d="M13 7l4 4-6 6-4-4z" />
    <path d="M7.5 12.5l-4-4 3-3 4 4M16.5 11.5l4 4-3 3-4-4M15 17a4 4 0 0 0 4-4" />
  </Icon>
);

export const BuildingIcon = () => (
  <Icon>
    <path d="M4 21V8l6-3v16M10 21V3l10 4v14M2 21h20M14 9h2M14 13h2M14 17h2M6 11h2M6 15h2" />
  </Icon>
);

export const CompassIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6l2.5 6H9.5zM12 18l-2.5-6h5z" fill="currentColor" stroke="none" />
  </Icon>
);

export const TiltIcon = () => (
  <Icon>
    <path d="M3 18l6-12h6l6 12z" />
    <path d="M7 14h10" />
  </Icon>
);

export const PinIcon = () => (
  <Icon>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icon>
);

export const CockpitIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.5 13h5l2 3h3l2-3h5M12 16v5" />
  </Icon>
);

export const LayersIcon = () => (
  <Icon>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Icon>
);

export const PresetIcons = {
  normal: () => (
    <Icon>
      <circle cx="12" cy="12" r="8" />
    </Icon>
  ),
  crt: () => (
    <Icon>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4M6 8h12M6 11h12M6 14h12" />
    </Icon>
  ),
  night: () => (
    <Icon>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </Icon>
  ),
  thermal: () => (
    <Icon>
      <path d="M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-2.5 1.5-4.5 3-6 0 2 1 3 2 3 0-2.5 0-4.5 1-7z" />
    </Icon>
  ),
  noir: () => (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </Icon>
  ),
};

export const MapStyleIcons = {
  satellite: () => (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M6 9c3 1 4 4 7 3s3-4 6-3M5 15c3-1 6 2 9 1" />
    </Icon>
  ),
  tactical: () => (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16M4 12h16" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  streets: () => (
    <Icon>
      <path d="M4 20L10 4M14 4l6 16M12 7v2M12 12v2M12 17v2" />
    </Icon>
  ),
  photoreal: () => (
    <Icon>
      <path d="M3 20V10l4-2v12M7 20V6l6-3v17M13 20V9l6 2v9M2 20h20" />
    </Icon>
  ),
};
