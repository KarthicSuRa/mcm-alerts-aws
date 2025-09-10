import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow as formatDistanceToNowDateFns } from 'date-fns';
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatDistanceToNow = (date: Date): string => {
  return formatDistanceToNowDateFns(date, { addSuffix: true });
};
