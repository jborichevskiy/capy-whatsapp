// Socket manager to avoid circular dependencies
let currentSocket: any = null;

export function setCurrentSocket(socket: any) {
  currentSocket = socket;
}

export function getCurrentSocket() {
  return currentSocket;
}