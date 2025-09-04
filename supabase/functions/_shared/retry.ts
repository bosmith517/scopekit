// _shared/retry.ts
// Exponential backoff with jitter

export function calculateBackoff(attempt: number): number {
  // Exponential: 1s, 2s, 4s, 8s, 16s
  const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 16000)
  // Add ±30% jitter
  const jitter = baseDelay * 0.3 * (Math.random() * 2 - 1)
  return Math.round(baseDelay + jitter)
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 5,
  onRetry?: (attempt: number, delay: number) => void
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts) throw error
      
      const delay = calculateBackoff(attempt)
      onRetry?.(attempt, delay)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max attempts exceeded')
}