let _uid = 0;

export function nextUid(prefix) {
  return `${prefix}${_uid++}`;
}
