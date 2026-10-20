/** Opening the existing inspector is a real action even for the default owner. */
export const providerSelectionMotionKey = (owner: string | undefined, open: boolean) => owner === undefined ? null : JSON.stringify([owner, open]);
