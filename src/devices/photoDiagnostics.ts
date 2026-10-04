const safeCodes = new Set([
  'invalid_photo_path', 'storage/unknown', 'storage/object-not-found', 'storage/bucket-not-found',
  'storage/project-not-found', 'storage/quota-exceeded', 'storage/unauthenticated', 'storage/unauthorized',
  'storage/retry-limit-exceeded', 'storage/canceled', 'storage/unsupported-environment',
])

export function photoErrorCode(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined
  if (typeof code === 'string' && safeCodes.has(code)) return code
  if (error instanceof Error && error.message === 'invalid_photo_path') return 'invalid_photo_path'
  return 'photo/download-failed'
}
