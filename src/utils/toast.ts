import { ExtendedNotification } from '../types';

// This is a placeholder for a more robust event emitter or state management solution.
let toastHandler: ((notification: ExtendedNotification) => void) | null = null;

export const setToastHandler = (handler: (notification: ExtendedNotification) => void) => {
  toastHandler = handler;
};

export const addToast = (notification: ExtendedNotification) => {
  if (toastHandler) {
    toastHandler(notification);
  } else {
    console.error('Toast handler not set. Cannot display toast:', notification);
  }
};
