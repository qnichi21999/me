// Instrumented modules import this live binding. Ordinary frames have no listener.
export let traceLine = null;

export function setTraceListener(next) {
  traceLine = next;
}
