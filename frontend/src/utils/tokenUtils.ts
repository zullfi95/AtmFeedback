/**
 * Утилиты для работы с JWT токенами (FeedbackATM standalone)
 */

/**
 * Проверяет, истек ли JWT токен
 * @param token - JWT токен
 * @returns true если токен истек или невалиден, false если валиден
 */
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) {
    return true;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return true;
    }
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) {
      return true;
    }
    const exp = payload.exp * 1000;
    const now = Date.now();
    const buffer = 30 * 1000; // 30 секунд
    return now >= (exp - buffer);
  } catch {
    return true;
  }
};
