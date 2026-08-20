export function isBoneyardBuild() {
  return typeof window !== "undefined" && (window as unknown as { __BONEYARD_BUILD?: boolean }).__BONEYARD_BUILD === true
}
