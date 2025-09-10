import React from 'react';

interface CountryToEmojiProps {
  countryCode: string;
}

export const CountryToEmoji: React.FC<CountryToEmojiProps> = ({ countryCode }) => {
  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return <span role="img" aria-label={`Flag for ${countryCode}`}>{getFlagEmoji(countryCode)}</span>;
};
