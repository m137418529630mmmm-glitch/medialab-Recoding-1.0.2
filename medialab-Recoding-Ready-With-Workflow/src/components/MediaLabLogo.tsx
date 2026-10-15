import React from 'react';

interface MediaLabLogoProps {
  className?: string;
}

export const MediaLabLogo: React.FC<MediaLabLogoProps> = ({
  className = 'h-10 w-auto',
}) => (
  <img
    src="./mediaLab_publishing_transparent.png"
    alt="medialab recording"
    draggable={false}
    className={`${className} object-contain select-none pointer-events-none`}
  />
);
